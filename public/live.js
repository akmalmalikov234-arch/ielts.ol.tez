(() => {
  "use strict";

  const INPUT_SAMPLE_RATE = 16000;
  const OUTPUT_SAMPLE_RATE = 24000;

  let socket = null;
  let audioContext = null;
  let microphoneStream = null;
  let microphoneSource = null;
  let processor = null;
  let silentGain = null;

  let running = false;
  let connected = false;

  let playbackTime = 0;

  const state = {
    userText: "",
    aiText: ""
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function createStyles() {
    if ($("#ieltsLiveStyles")) {
      return;
    }

    const style =
      document.createElement("style");

    style.id = "ieltsLiveStyles";

    style.textContent = `
      .ielts-live-card {
        margin-top: 24px;
        padding: 24px;
        border: 1px solid var(--border, #252d42);
        border-radius: 24px;
        background:
          radial-gradient(
            circle at 85% 10%,
            rgba(101,231,255,.08),
            transparent 35%
          ),
          linear-gradient(
            145deg,
            #11182a,
            #090d18
          );
        box-shadow:
          0 20px 60px rgba(0,0,0,.35);
      }

      .ielts-live-top {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:18px;
      }

      .ielts-live-label {
        color:var(--lime, #c8ff42);
        font-size:11px;
        font-weight:800;
        letter-spacing:.16em;
        margin-bottom:8px;
      }

      .ielts-live-title {
        margin:0;
        color:var(--text, #f6f8ff);
        font-size:25px;
        line-height:1.15;
      }

      .ielts-live-description {
        margin:9px 0 0;
        color:var(--muted, #8d98b4);
        font-size:14px;
        line-height:1.55;
      }

      .ielts-live-status {
        display:flex;
        align-items:center;
        gap:8px;
        padding:8px 12px;
        border:1px solid var(--border, #252d42);
        border-radius:999px;
        color:var(--muted, #8d98b4);
        font-size:12px;
        white-space:nowrap;
      }

      .ielts-live-dot {
        width:8px;
        height:8px;
        border-radius:50%;
        background:#68738f;
      }

      .ielts-live-status.live
      .ielts-live-dot {
        background:var(--lime, #c8ff42);
        box-shadow:
          0 0 14px
          rgba(200,255,66,.7);
      }

      .ielts-live-window {
        margin-top:20px;
        min-height:220px;
        padding:16px;
        border:1px solid var(--border, #252d42);
        border-radius:18px;
        background:rgba(0,0,0,.18);
      }

      .ielts-live-messages {
        max-height:260px;
        overflow:auto;
      }

      .ielts-live-empty {
        color:var(--muted, #8d98b4);
        font-size:14px;
        line-height:1.55;
        padding:10px 4px;
      }

      .ielts-live-message {
        margin-bottom:10px;
        padding:11px 13px;
        border-radius:14px;
        line-height:1.55;
        font-size:14px;
      }

      .ielts-live-user {
        background:
          rgba(101,231,255,.07);
        border:
          1px solid
          rgba(101,231,255,.13);
      }

      .ielts-live-ai {
        background:
          rgba(200,255,66,.07);
        border:
          1px solid
          rgba(200,255,66,.13);
      }

      .ielts-live-message-name {
        display:block;
        margin-bottom:4px;
        font-size:10px;
        font-weight:800;
        letter-spacing:.08em;
        opacity:.55;
      }

      .ielts-live-controls {
        display:flex;
        justify-content:center;
        margin-top:18px;
      }

      .ielts-live-button {
        width:78px;
        height:78px;
        border:0;
        border-radius:50%;
        cursor:pointer;
        background:var(--lime, #c8ff42);
        color:#07100a;
        font-size:28px;
        box-shadow:
          0 14px 40px
          rgba(200,255,66,.18);
      }

      .ielts-live-button.active {
        background:var(--red, #ff4e69);
        color:#fff;
      }

      .ielts-live-note {
        margin-top:12px;
        text-align:center;
        color:var(--muted, #8d98b4);
        font-size:12px;
      }

      @media(max-width:700px) {
        .ielts-live-top {
          flex-direction:column;
        }

        .ielts-live-title {
          font-size:21px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createCard() {
    const speaking =
      $("#speaking");

    if (!speaking) {
      return;
    }

    if ($("#ieltsLiveCard")) {
      return;
    }

    createStyles();

    const card =
      document.createElement("div");

    card.id = "ieltsLiveCard";
    card.className =
      "ielts-live-card";

    card.innerHTML = `
      <div class="ielts-live-top">

        <div>
          <div class="ielts-live-label">
            LIVE SPEAKING
          </div>

          <h3 class="ielts-live-title">
            📞 Telefon kabi Ustoz bilan gaplash
          </h3>

          <p class="ielts-live-description">
            Mikrofonni yoqing va IELTS Ustoz
            bilan real-time tabiiy suhbat qiling.
          </p>
        </div>

        <div
          id="ieltsLiveStatus"
          class="ielts-live-status"
        >
          <span
            class="ielts-live-dot"
          ></span>

          <span>
            Tayyor
          </span>
        </div>

      </div>

      <div class="ielts-live-window">

        <div
          id="ieltsLiveMessages"
          class="ielts-live-messages"
        >
          <div class="ielts-live-empty">
            📞 Qo‘ng‘iroq tugmasini bosing.
            Ustoz IELTS Speaking savolini beradi.
          </div>
        </div>

      </div>

      <div class="ielts-live-controls">

        <button
          id="ieltsLiveButton"
          class="ielts-live-button"
          type="button"
          aria-label="Live Speaking"
        >
          📞
        </button>

      </div>

      <div class="ielts-live-note">
        Mikrofon ruxsati kerak.
      </div>
    `;

    speaking.appendChild(card);

    $("#ieltsLiveButton")
      .addEventListener(
        "click",
        () => {
          if (running) {
            stopCall();
          } else {
            startCall();
          }
        }
      );
  }

  function status(
    text,
    live = false
  ) {
    const element =
      $("#ieltsLiveStatus");

    if (!element) {
      return;
    }

    element.classList.toggle(
      "live",
      live
    );

    const textElement =
      element.querySelector(
        "span:last-child"
      );

    if (textElement) {
      textElement.textContent =
        text;
    }
  }

  function button(
    active
  ) {
    const element =
      $("#ieltsLiveButton");

    if (!element) {
      return;
    }

    element.classList.toggle(
      "active",
      active
    );

    element.textContent =
      active
        ? "⏹️"
        : "📞";
  }

  function addMessage(
    name,
    text,
    type
  ) {
    if (!text?.trim()) {
      return;
    }

    const box =
      $("#ieltsLiveMessages");

    if (!box) {
      return;
    }

    const empty =
      box.querySelector(
        ".ielts-live-empty"
      );

    if (empty) {
      empty.remove();
    }

    const item =
      document.createElement("div");

    item.className =
      `ielts-live-message ${
        type === "ai"
          ? "ielts-live-ai"
          : "ielts-live-user"
      }`;

    const nameElement =
      document.createElement("span");

    nameElement.className =
      "ielts-live-message-name";

    nameElement.textContent =
      name;

    const textElement =
      document.createElement("div");

    textElement.textContent =
      text;

    item.append(
      nameElement,
      textElement
    );

    box.appendChild(item);

    box.scrollTop =
      box.scrollHeight;
  }

  function base64ToBytes(
    value
  ) {
    const binary =
      atob(value);

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

    return bytes;
  }

  function bytesToBase64(
    bytes
  ) {
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

  function downsample(
    input,
    fromRate
  ) {
    if (
      fromRate ===
      INPUT_SAMPLE_RATE
    ) {
      return input;
    }

    const ratio =
      fromRate /
      INPUT_SAMPLE_RATE;

    const length =
      Math.round(
        input.length /
        ratio
      );

    const result =
      new Float32Array(
        length
      );

    for (
      let i = 0;
      i < length;
      i++
    ) {
      const start =
        Math.floor(
          i * ratio
        );

      const end =
        Math.min(
          Math.floor(
            (i + 1) * ratio
          ),
          input.length
        );

      let total = 0;
      let count = 0;

      for (
        let j = start;
        j < end;
        j++
      ) {
        total +=
          input[j];

        count++;
      }

      result[i] =
        count
          ? total / count
          : 0;
    }

    return result;
  }

  function floatToPCM(
    data
  ) {
    const buffer =
      new ArrayBuffer(
        data.length * 2
      );

    const view =
      new DataView(buffer);

    for (
      let i = 0;
      i < data.length;
      i++
    ) {
      const sample =
        Math.max(
          -1,
          Math.min(
            1,
            data[i]
          )
        );

      const value =
        sample < 0
          ? sample * 0x8000
          : sample * 0x7fff;

      view.setInt16(
        i * 2,
        value,
        true
      );
    }

    return new Uint8Array(
      buffer
    );
  }

  function playAudio(
    base64
  ) {
    if (!audioContext) {
      return;
    }

    const bytes =
      base64ToBytes(base64);

    const samples =
      Math.floor(
        bytes.length / 2
      );

    const buffer =
      audioContext.createBuffer(
        1,
        samples,
        OUTPUT_SAMPLE_RATE
      );

    const channel =
      buffer.getChannelData(0);

    const view =
      new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength
      );

    for (
      let i = 0;
      i < samples;
      i++
    ) {
      channel[i] =
        view.getInt16(
          i * 2,
          true
        ) / 32768;
    }

    const source =
      audioContext.createBufferSource();

    source.buffer =
      buffer;

    source.connect(
      audioContext.destination
    );

    const now =
      audioContext.currentTime;

    if (
      playbackTime <
      now
    ) {
      playbackTime =
        now + 0.03;
    }

    source.start(
      playbackTime
    );

    playbackTime +=
      buffer.duration;
  }

  function handleMessage(
    raw
  ) {
    let message;

    try {
      message =
        JSON.parse(raw);
    } catch {
      return;
    }

    if (
      message.type ===
      "error"
    ) {
      console.error(
        "Gemini Live:",
        message.error
      );

      status(
        message.error ||
        "Live xatolik",
        false
      );

      stopCall();

      return;
    }

    if (
      message.type ===
      "connected"
    ) {
      connected = true;

      status(
        "Ustoz tayyor",
        true
      );

      return;
    }

    const content =
      message.serverContent;

    if (!content) {
      return;
    }

    if (
      content.inputTranscription?.text
    ) {
      state.userText +=
        content
          .inputTranscription
          .text;
    }

    if (
      content.outputTranscription?.text
    ) {
      state.aiText +=
        content
          .outputTranscription
          .text;
    }

    if (
      content.modelTurn?.parts
    ) {
      for (
        const part of
          content.modelTurn.parts
      ) {
        if (
          part.inlineData?.data
        ) {
          playAudio(
            part.inlineData.data
          );
        }
      }
    }

    if (
      content.turnComplete
    ) {
      if (
        state.userText.trim()
      ) {
        addMessage(
          "SIZ",
          state.userText,
          "user"
        );
      }

      if (
        state.aiText.trim()
      ) {
        addMessage(
          "IELTS USTOZ",
          state.aiText,
          "ai"
        );
      }

      state.userText = "";
      state.aiText = "";

      status(
        "Siz gapiring...",
        true
      );
    }
  }

  async function getToken() {
    const response =
      await fetch(
        "/api/live-token",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: "{}"
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "Gemini token olinmadi."
      );
    }

    return data;
  }

  async function connect(
    token,
    model
  ) {
    const protocol =
      location.protocol ===
      "https:"
        ? "wss:"
        : "ws:";

    const url =
      `${protocol}//${location.host}/ws/live`;

    return new Promise(
      (resolve, reject) => {
        socket =
          new WebSocket(url);

        socket.onopen =
          () => {
            socket.send(
              JSON.stringify({
                type:
                  "auth",
                token,
                model
              })
            );

            resolve();
          };

        socket.onmessage =
          event => {
            handleMessage(
              event.data
            );
          };

        socket.onerror =
          () => {
            reject(
              new Error(
                "Live WebSocket ulanishida xatolik."
              )
            );
          };

        socket.onclose =
          () => {
            connected = false;

            if (running) {
              status(
                "Ulanish yopildi",
                false
              );
            }
          };
      }
    );
  }

  async function openMicrophone() {
    microphoneStream =
      await navigator
        .mediaDevices
        .getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

    audioContext =
      new AudioContext();

    await audioContext.resume();

    microphoneSource =
      audioContext
        .createMediaStreamSource(
          microphoneStream
        );

    processor =
      audioContext
        .createScriptProcessor(
          4096,
          1,
          1
        );

    silentGain =
      audioContext.createGain();

    silentGain.gain.value = 0;

    processor.onaudioprocess =
      event => {
        if (
          !running ||
          !connected ||
          !socket ||
          socket.readyState !==
            WebSocket.OPEN
        ) {
          return;
        }

        const input =
          event.inputBuffer
            .getChannelData(0);

        const copy =
          new Float32Array(
            input.length
          );

        copy.set(input);

        const audio =
          downsample(
            copy,
            audioContext
              .sampleRate
          );

        const pcm =
          floatToPCM(audio);

        socket.send(
          JSON.stringify({
            realtimeInput: {
              audio: {
                data:
                  bytesToBase64(
                    pcm
                  ),
                mimeType:
                  "audio/pcm;rate=16000"
              }
            }
          })
        );
      };

    microphoneSource.connect(
      processor
    );

    processor.connect(
      silentGain
    );

    silentGain.connect(
      audioContext.destination
    );
  }

  async function startCall() {
    if (running) {
      return;
    }

    if (
      !navigator.mediaDevices
        ?.getUserMedia
    ) {
      status(
        "Brauzer mikrofonni qo‘llamaydi.",
        false
      );

      return;
    }

    if (
      !window.isSecureContext &&
      location.hostname !==
        "localhost"
    ) {
      status(
        "Mikrofon uchun HTTPS kerak.",
        false
      );

      return;
    }

    running = true;
    connected = false;

    state.userText = "";
    state.aiText = "";

    button(true);

    status(
      "Ustozga ulanmoqda...",
      false
    );

    try {
      const auth =
        await getToken();

      await connect(
        auth.token,
        auth.model
      );

      await openMicrophone();

      status(
        "Ustozga qo‘ng‘iroq qilindi",
        true
      );

      /*
       * Birinchi savolni Ustozning
       * o‘zi boshlaydi.
       */
      socket.send(
        JSON.stringify({
          clientContent: {
            turns: [
              {
                role: "user",
                parts: [
                  {
                    text:
                      "IELTS Speaking practice ni boshlang. O‘quvchiga sokin va tabiiy tarzda salom bering va Part 1 uchun bitta savol bering."
                  }
                ]
              }
            ],
            turnComplete: true
          }
        })
      );

    } catch (error) {
      console.error(
        error
      );

      status(
        error.message ||
        "Suhbatni boshlashda xatolik.",
        false
      );

      await stopCall();
    }
  }

  async function stopCall() {
    running = false;
    connected = false;

    button(false);

    if (processor) {
      processor.disconnect();
      processor = null;
    }

    if (microphoneSource) {
      microphoneSource.disconnect();
      microphoneSource = null;
    }

    if (silentGain) {
      silentGain.disconnect();
      silentGain = null;
    }

    if (microphoneStream) {
      microphoneStream
        .getTracks()
        .forEach(track => {
          track.stop();
        });

      microphoneStream = null;
    }

    if (socket) {
      try {
        socket.close();
      } catch {}

      socket = null;
    }

    if (audioContext) {
      try {
        await audioContext.close();
      } catch {}

      audioContext = null;
    }

    playbackTime = 0;

    status(
      "Suhbat tugadi",
      false
    );
  }

  function init() {
    createCard();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();
