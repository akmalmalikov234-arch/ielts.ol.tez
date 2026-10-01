const live = {

  socket: null,

  stream: null,

  audioContext: null,

  micSource: null,

  processor: null,

  ready: false,

  running: false,

  playbackContext: null,

  nextPlayTime: 0,

  sources: new Set()

};


const liveEl = id =>
  document.getElementById(id);


function liveStatus(text) {

  const el =
    liveEl("liveStatus");

  if (el) {
    el.textContent = text;
  }

}


function escapeHTMLLive(value) {

  return String(value)
    .replace(
      /[&<>"']/g,
      ch => ({

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"

      }[ch])
    );

}


function liveAddTranscript(
  who,
  text
) {

  if (!text) return;

  const box =
    liveEl("liveTranscript");

  if (!box) return;


  const row =
    document.createElement(
      "div"
    );

  row.className =
    `live-line ${who}`;


  row.innerHTML = `

    <b>
      ${
        who === "user"
          ? "Siz"
          : "Ustoz AI"
      }
    </b>

    <span>
      ${escapeHTMLLive(text)}
    </span>

  `;


  box.appendChild(row);

  box.scrollTop =
    box.scrollHeight;

}


function stopPlayback() {

  for (
    const source
    of live.sources
  ) {

    try {
      source.stop();
    } catch {}

  }


  live.sources.clear();


  if (
    live.playbackContext
  ) {

    live.nextPlayTime =
      live.playbackContext
        .currentTime;

  }

}


function base64ToInt16(
  base64
) {

  const binary =
    atob(base64);

  const bytes =
    new Uint8Array(
      binary.length
    );


  for (
    let i = 0;
    i < binary.length;
    i++
  ) {

    bytes[i] =
      binary.charCodeAt(i);

  }


  return new Int16Array(
    bytes.buffer
  );

}


async function playPcm24k(
  base64
) {

  if (
    !live.playbackContext
  ) {

    live.playbackContext =
      new AudioContext({
        sampleRate: 24000
      });

  }


  if (
    live.playbackContext.state ===
    "suspended"
  ) {

    await live.playbackContext
      .resume();

  }


  const pcm =
    base64ToInt16(
      base64
    );


  const buffer =
    live.playbackContext
      .createBuffer(
        1,
        pcm.length,
        24000
      );


  const channel =
    buffer.getChannelData(0);


  for (
    let i = 0;
    i < pcm.length;
    i++
  ) {

    channel[i] =
      pcm[i] / 32768;

  }


  const source =
    live.playbackContext
      .createBufferSource();


  source.buffer =
    buffer;


  source.connect(
    live.playbackContext
      .destination
  );


  const now =
    live.playbackContext
      .currentTime;


  live.nextPlayTime =
    Math.max(
      live.nextPlayTime,
      now + 0.02
    );


  source.start(
    live.nextPlayTime
  );


  live.nextPlayTime +=
    buffer.duration;


  live.sources.add(
    source
  );


  source.onended = () =>
    live.sources.delete(
      source
    );

}


function downsampleTo16k(
  float32,
  inputRate
) {

  if (
    inputRate === 16000
  ) {

    const result =
      new Int16Array(
        float32.length
      );


    for (
      let i = 0;
      i < float32.length;
      i++
    ) {

      const sample =
        Math.max(
          -1,
          Math.min(
            1,
            float32[i]
          )
        );


      result[i] =
        sample < 0
          ? sample * 32768
          : sample * 32767;

    }


    return result;

  }


  const ratio =
    inputRate / 16000;


  const newLength =
    Math.round(
      float32.length / ratio
    );


  const result =
    new Int16Array(
      newLength
    );


  let offset = 0;


  for (
    let i = 0;
    i < newLength;
    i++
  ) {

    const nextOffset =
      Math.min(
        float32.length,
        Math.round(
          (i + 1) * ratio
        )
      );


    let sum = 0;

    let count = 0;


    for (
      let j = offset;
      j < nextOffset;
      j++
    ) {

      sum += float32[j];

      count++;

    }


    const sample =
      count
        ? sum / count
        : 0;


    const clipped =
      Math.max(
        -1,
        Math.min(
          1,
          sample
        )
      );


    result[i] =
      clipped < 0
        ? clipped * 32768
        : clipped * 32767;


    offset =
      nextOffset;

  }


  return result;

}


function int16ToBase64(
  int16
) {

  const bytes =
    new Uint8Array(
      int16.buffer,
      int16.byteOffset,
      int16.byteLength
    );


  let binary = "";

  const chunk =
    0x8000;


  for (
    let i = 0;
    i < bytes.length;
    i += chunk
  ) {

    binary +=
      String.fromCharCode(
        ...bytes.subarray(
          i,
          i + chunk
        )
      );

  }


  return btoa(binary);

}


async function startMicrophone() {

  if (live.stream) return;


  live.stream =
    await navigator
      .mediaDevices
      .getUserMedia({

        audio: {

          channelCount: 1,

          echoCancellation:
            true,

          noiseSuppression:
            true,

          autoGainControl:
            true

        }

      });


  live.audioContext =
    new AudioContext();


  await live.audioContext
    .resume();


  live.micSource =
    live.audioContext
      .createMediaStreamSource(
        live.stream
      );


  live.processor =
    live.audioContext
      .createScriptProcessor(
        4096,
        1,
        1
      );


  live.processor.onaudioprocess =
    event => {

      if (
        !live.running ||
        !live.ready ||
        !live.socket ||
        live.socket.readyState !==
          WebSocket.OPEN
      ) {

        return;

      }


      const input =
        event.inputBuffer
          .getChannelData(0);


      const pcm =
        downsampleTo16k(
          input,
          live.audioContext
            .sampleRate
        );


      if (!pcm.length) {
        return;
      }


      live.socket.send(

        JSON.stringify({

          type:
            "audio",

          data:
            int16ToBase64(
              pcm
            )

        })

      );

    };


  live.micSource.connect(
    live.processor
  );


  const silentGain =
    live.audioContext
      .createGain();


  silentGain.gain.value =
    0;


  live.processor.connect(
    silentGain
  );


  silentGain.connect(
    live.audioContext
      .destination
  );

}


function stopMicrophone() {

  if (
    live.processor
  ) {

    try {
      live.processor
        .disconnect();
    } catch {}

  }


  if (
    live.micSource
  ) {

    try {
      live.micSource
        .disconnect();
    } catch {}

  }


  if (live.stream) {

    live.stream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

  }


  if (
    live.audioContext
  ) {

    live.audioContext
      .close()
      .catch(() => {});

  }


  live.processor = null;

  live.micSource = null;

  live.stream = null;

  live.audioContext = null;

}


function wsUrl() {

  const protocol =
    location.protocol ===
    "https:"
      ? "wss:"
      : "ws:";


  return `${protocol}//${location.host}/ws/live`;

}


function connectLive() {

  if (
    live.socket &&
    live.socket.readyState ===
      WebSocket.OPEN
  ) {

    return;

  }


  liveStatus(
    "Ulanmoqda..."
  );


  liveEl(
    "liveStart"
  ).disabled = true;


  liveEl(
    "liveStop"
  ).disabled = false;


  live.socket =
    new WebSocket(
      wsUrl()
    );


  live.socket.onopen =
    () => {

      const profile = {

        target:
          typeof state !==
          "undefined"
            ? state.target
            : null,

        deadline:
          typeof state !==
          "undefined"
            ? state.deadline
            : "",

        level:
          typeof state !==
          "undefined"
            ? state.level
            : "A2-B1"

      };


      live.socket.send(

        JSON.stringify({

          type:
            "config",

          profile

        })

      );


      liveStatus(
        "Ustoz tayyorlanmoqda..."
      );

    };


  live.socket.onmessage =
    async event => {

      let message;

      try {

        message =
          JSON.parse(
            event.data
          );

      } catch {

        return;

      }


      if (
        message.type ===
        "ready"
      ) {

        live.ready =
          true;

        live.running =
          true;


        liveStatus(
          "Jonli suhbat boshlandi — gapiring 🎙️"
        );


        try {

          await startMicrophone();

        } catch {

          liveStatus(
            "Mikrofonga ruxsat berilmadi."
          );

          stopLive();

        }


        return;

      }


      if (
        message.type ===
        "input_transcript"
      ) {

        liveAddTranscript(
          "user",
          message.text
        );

        return;

      }


      if (
        message.type ===
        "output_transcript"
      ) {

        liveAddTranscript(
          "teacher",
          message.text
        );

        return;

      }


      if (
        message.type ===
        "audio"
      ) {

        await playPcm24k(
          message.data
        );

        return;

      }


      if (
        message.type ===
        "interrupted"
      ) {

        stopPlayback();

        return;

      }


      if (
        message.type ===
        "turn_complete"
      ) {

        liveStatus(
          "Sizning navbatingiz 🎙️"
        );

        return;

      }


      if (
        message.type ===
        "error"
      ) {

        liveStatus(
          `Xatolik: ${message.message}`
        );

      }

    };


  live.socket.onerror =
    () => {

      liveStatus(
        "Live API ulanishida xatolik."
      );

    };


  live.socket.onclose =
    () => {

      live.ready =
        false;

      live.running =
        false;


      stopMicrophone();


      liveEl(
        "liveStart"
      ).disabled = false;


      liveEl(
        "liveStop"
      ).disabled = true;


      liveStatus(
        "Jonli suhbat tugadi."
      );

    };

}


function stopLive() {

  live.running =
    false;

  live.ready =
    false;


  stopMicrophone();

  stopPlayback();


  if (live.socket) {

    try {

      live.socket.close(
        1000,
        "user stopped"
      );

    } catch {}

  }


  live.socket =
    null;


  liveEl(
    "liveStart"
  ).disabled = false;


  liveEl(
    "liveStop"
  ).disabled = true;


  liveStatus(
    "Boshlash uchun tugmani bosing."
  );

}


liveEl(
  "liveStart"
)?.addEventListener(
  "click",
  () => {

    if (
      !navigator
        .mediaDevices
        ?.getUserMedia
    ) {

      liveStatus(
        "Bu brauzer mikrofonni qo'llab-quvvatlamaydi."
      );

      return;

    }


    connectLive();

  }
);


liveEl(
  "liveStop"
)?.addEventListener(
  "click",
  stopLive
);
