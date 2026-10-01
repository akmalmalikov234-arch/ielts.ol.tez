(() => {
  "use strict";

  const INPUT_RATE = 16000;
  const OUTPUT_RATE = 24000;

  let ws = null;
  let ctx = null;
  let stream = null;
  let source = null;
  let processor = null;
  let mute = null;

  let running = false;
  let ready = false;

  let outputTime = 0;
  let startedAt = 0;
  let timer = null;

  let userLine = null;
  let aiLine = null;

  const ui = {};


  // ===================================================
  // HELPERS
  // ===================================================

  const $ = (
    selector,
    root = document
  ) =>
    root.querySelector(
      selector
    );


  function el(
    tag,
    className,
    text
  ) {
    const node =
      document.createElement(
        tag
      );

    if (className) {
      node.className =
        className;
    }

    if (
      text !== undefined
    ) {
      node.textContent =
        text;
    }

    return node;
  }


  // ===================================================
  // DESIGN
  // ===================================================

  function addStyles() {
    if (
      $("#liveSpeakingStyles")
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "liveSpeakingStyles";

    style.textContent = `
      .live-speaking-card {
        margin-top: 18px;
        padding: 22px;
        border: 1px solid rgba(200,255,66,.22);
        border-radius: 22px;
        background:
          radial-gradient(
            circle at 85% 15%,
            rgba(101,231,255,.08),
            transparent 35%
          ),
          linear-gradient(
            145deg,
            #11182a,
            #0a0f1c
          );
        box-shadow:
          0 18px 50px rgba(0,0,0,.28);
      }

      .live-speaking-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
        margin-bottom: 18px;
      }

      .live-speaking-kicker {
        color: #c8ff42;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .15em;
        margin-bottom: 7px;
      }

      .live-speaking-title {
        margin: 0;
        font-size: 24px;
        line-height: 1.15;
      }

      .live-speaking-subtitle {
        margin: 8px 0 0;
        color: #8d98b4;
        line-height: 1.55;
        font-size: 14px;
      }

      .live-status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid #252d42;
        border-radius: 999px;
        padding: 8px 11px;
        color: #8d98b4;
        font-size: 12px;
        white-space: nowrap;
      }

      .live-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #69738d;
      }

      .live-status.is-live
      .live-status-dot {
        background: #c8ff42;
        box-shadow:
          0 0 14px
          rgba(200,255,66,.7);
      }

      .live-phone {
        min-height: 210px;
        border: 1px solid #252d42;
        border-radius: 18px;
        padding: 18px;
        background:
          rgba(6,8,17,.52);
      }

      .live-conversation {
        max-height: 260px;
        overflow: auto;
        padding-right: 4px;
      }

      .live-empty {
        color: #68738f;
        font-size: 14px;
        line-height: 1.55;
        padding: 8px 2px;
      }

      .live-line {
        margin-bottom: 10px;
        padding: 10px 12px;
        border-radius: 13px;
        line-height: 1.5;
        font-size: 14px;
      }

      .live-line-user {
        background:
          rgba(101,231,255,.08);
        border:
          1px solid
          rgba(101,231,255,.12);
      }

      .live-line-ai {
        background:
          rgba(200,255,66,.07);
        border:
          1px solid
          rgba(200,255,66,.12);
      }

      .live-line-label {
        display: block;
        margin-bottom: 3px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .08em;
        opacity: .55;
      }

      .live-speaking-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 16px;
      }

      .live-call-button {
        width: 76px;
        height: 76px;
        border: 0;
        border-radius: 50%;
        cursor: pointer;
        background: #c8ff42;
        color: #07100a;
        font-size: 27px;
        box-shadow:
          0 12px 35px
          rgba(200,255,66,.16);
        transition:
          transform .15s ease,
          box-shadow .15s ease;
      }

      .live-call-button:hover {
        transform:
          translateY(-2px);
      }

      .live-call-button.is-active {
        background: #ff4e69;
        color: white;
      }

      .live-speaking-note {
        margin-top: 13px;
        text-align: center;
        color: #68738f;
        font-size: 12px;
      }

      .live-timer {
        margin-left: 10px;
      }

      @media (max-width: 700px) {
        .live-speaking-head {
          flex-direction: column;
        }

        .live-speaking-title {
          font-size: 21px;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }


  // ===================================================
  // BUILD INSIDE EXISTING SPEAKING SECTION
  // ===================================================

  function buildUI() {
    const speaking =
      $("#speaking");

    if (!speaking) {
      return false;
    }

    if (
      $("#liveSpeakingCard")
    ) {
      return true;
    }

    addStyles();

    const card =
      el(
        "article",
        "card live-speaking-card"
      );

    card.id =
      "liveSpeakingCard";


    const head =
      el(
        "div",
        "live-speaking-head"
      );

    const left =
      document.createElement(
        "div"
      );


    left.append(
      el(
        "div",
        "live-speaking-kicker",
        "LIVE SPEAKING"
      ),

      el(
        "h3",
        "live-speaking-title",
        "Telefon kabi Ustoz bilan gaplash"
      ),

      el(
        "p",
        "live-speaking-subtitle",
        "Mikrofonni yoqing va IELTS ustoz bilan real-time ingliz tilida tabiiy suhbat qiling."
      )
    );


    const status =
      el(
        "div",
        "live-status"
      );

    const dot =
      el(
        "span",
        "live-status-dot"
      );

    const statusText =
      el(
        "span",
        "",
        "Tayyor"
      );

    status.append(
      dot,
      statusText
    );

    head.append(
      left,
      status
    );


    const phone =
      el(
        "div",
        "live-phone"
      );

    const conversation =
      el(
        "div",
        "live-conversation"
      );

    conversation.append(
      el(
        "div",
        "live-empty",
        "📞 Qo‘ng‘iroq tugmasini bosing. Ustoz avval IELTS Speaking savolini beradi."
      )
    );

    phone.append(
      conversation
    );


    const controls =
      el(
        "div",
        "live-speaking-controls"
      );

    const button =
      el(
        "button",
        "live-call-button",
        "📞"
      );

    button.type =
      "button";

    button.title =
      "Live Speaking boshlash";

    controls.append(
      button
    );


    const note =
      el(
        "div",
        "live-speaking-note",
        "Mikrofon ruxsati kerak"
      );

    const timerEl =
      el(
        "span",
        "live-timer",
        "00:00"
      );

    note.append(
      timerEl
    );


    card.append(
      head,
      phone,
      controls,
      note
    );


    const result =
      $(
        "#speakingResult",
        speaking
      );

    if (result) {
      speaking.insertBefore(
        card,
        result
      );
    } else {
      speaking.append(
        card
      );
    }


    ui.card =
      card;

    ui.status =
      statusText;

    ui.statusWrap =
      status;

    ui.button =
      button;

    ui.conversation =
      conversation;

    ui.timer =
      timerEl;


    button.addEventListener(
      "click",
      () => {
        if (running) {
          stop();
        } else {
          start();
        }
      }
    );

    return true;
  }


  // ===================================================
  // UI STATUS
  // ===================================================

  function setStatus(
    text,
    live = false
  ) {
    if (ui.status) {
      ui.status.textContent =
        text;
    }

    if (ui.statusWrap) {
      ui.statusWrap.classList.toggle(
        "is-live",
        live
      );
    }
  }


  function setButton(
    active
  ) {
    if (!ui.button) {
      return;
    }

    ui.button.classList.toggle(
      "is-active",
      active
    );

    ui.button.textContent =
      active
        ? "⏹"
        : "📞";
  }


  function clearEmpty() {
    const empty =
      $(
        ".live-empty",
        ui.conversation
      );

    if (empty) {
      empty.remove();
    }
  }


  // ===================================================
  // TRANSCRIPT UI
  // ===================================================

  function addLine(
    who,
    text
  ) {
    if (!text?.trim()) {
      return null;
    }

    clearEmpty();

    const isUser =
      who === "Siz";

    const line =
      el(
        "div",
        `live-line ${
          isUser
            ? "live-line-user"
            : "live-line-ai"
        }`
      );

    line.append(
      el(
        "span",
        "live-line-label",
        who
      ),

      el(
        "span",
        "",
        text.trim()
      )
    );

    ui.conversation.append(
      line
    );

    ui.conversation.scrollTop =
      ui.conversation.scrollHeight;

    return line.lastElementChild;
  }


  function updateLine(
    node,
    text
  ) {
    if (
      !node ||
      !text?.trim()
    ) {
      return;
    }

    node.textContent =
      text.trim();

    ui.conversation.scrollTop =
      ui.conversation.scrollHeight;
  }


  // ===================================================
  // BASE64 / PCM
  // ===================================================

  function bytesFromBase64(
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

    return bytes;
  }


  function base64FromBytes(
    bytes
  ) {
    let binary = "";

    for (
      let i = 0;
      i < bytes.length;
      i += 0x8000
    ) {
      binary +=
        String.fromCharCode(
          ...bytes.subarray(
            i,
            i + 0x8000
          )
        );
    }

    return btoa(binary);
  }


  function pcm16(
    input
  ) {
    const buffer =
      new ArrayBuffer(
        input.length * 2
      );

    const view =
      new DataView(
        buffer
      );

    for (
      let i = 0;
      i < input.length;
      i++
    ) {
      const sample =
        Math.max(
          -1,
          Math.min(
            1,
            input[i]
          )
        );

      view.setInt16(
        i * 2,

        sample < 0
          ? sample * 32768
          : sample * 32767,

        true
      );
    }

    return new Uint8Array(
      buffer
    );
  }


  function downsample(
    input,
    inputRate
  ) {
    if (
      inputRate ===
      INPUT_RATE
    ) {
      return input;
    }

    const length =
      Math.max(
        1,
        Math.round(
          input.length *
          INPUT_RATE /
          inputRate
        )
      );

    const output =
      new Float32Array(
        length
      );

    const ratio =
      inputRate /
      INPUT_RATE;

    for (
      let i = 0;
      i < length;
      i++
    ) {
      const position =
        i * ratio;

      const left =
        Math.floor(
          position
        );

      const right =
        Math.min(
          left + 1,
          input.length - 1
        );

      const amount =
        position - left;

      output[i] =
        input[left] *
          (1 - amount) +
        input[right] *
          amount;
    }

    return output;
  }


  // ===================================================
  // PLAY GEMINI PCM
  // ===================================================

  function playPCM(
    base64
  ) {
    if (!ctx) {
      return;
    }

    const bytes =
      bytesFromBase64(
        base64
      );

    const count =
      Math.floor(
        bytes.length / 2
      );

    const buffer =
      ctx.createBuffer(
        1,
        count,
        OUTPUT_RATE
      );

    const channel =
      buffer.getChannelData(
        0
      );

    const view =
      new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength
      );

    for (
      let i = 0;
      i < count;
      i++
    ) {
      channel[i] =
        view.getInt16(
          i * 2,
          true
        ) / 32768;
    }

    const node =
      ctx.createBufferSource();

    node.buffer =
      buffer;

    node.connect(
      ctx.destination
    );

    const now =
      ctx.currentTime;

    if (
      outputTime <
      now
    ) {
      outputTime =
        now + 0.03;
    }

    node.start(
      outputTime
    );

    outputTime +=
      buffer.duration;
  }


  // ===================================================
  // GET GEMINI EPHEMERAL TOKEN
  // ===================================================

  async function getToken() {
    const response =
      await fetch(
        "/api/live-token",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            "{}"
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {
      throw new Error(
        data.error ||
        `Live token error ${response.status}`
      );
    }

    if (!data.token) {
      throw new Error(
        "Gemini Live token olinmadi."
      );
    }

    return data;
  }


  // ===================================================
  // GEMINI SETUP
  // ===================================================

  function sendSetup(
    model,
    voice
  ) {
    ws.send(
      JSON.stringify({
        setup: {
          model:
            `models/${model}`,

          generationConfig: {
            responseModalities: [
              "AUDIO"
            ],

            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName:
                    voice ||
                    "Kore"
                }
              }
            }
          },

          inputAudioTranscription:
            {},

          outputAudioTranscription:
            {},

          systemInstruction: {
            parts: [
              {
                text:
                  `
Sen IELTS USTOZ AI'san.

O'quvchi bilan huddi
telefonda gaplashayotgandek
real-time IELTS Speaking
mashqi qil.

Ovozing:

- sokin
- tabiiy
- samimiy
- ustozona

Gaplarni qisqa
va tabiiy qil.

O'quvchi gapirayotgan
paytda uni bo'lma.

O'quvchi javobini
tugatgach javob ber.

Suhbat asosan
ingliz tilida bo'lsin.

O'quvchi o'zbekcha
tushuntirish so'rasa
o'zbekcha tushuntir.

IELTS Speaking:

Part 1
Part 2
Part 3

savollaridan foydalan.

Kerak bo'lsa grammar
va vocabulary xatolarini
muloyim tuzat.

Birinchi bo'lib
salomlash.

Keyin IELTS Speaking
Part 1 uchun bitta
savol ber.
`
              }
            ]
          }
        }
      })
    );
  }


  // ===================================================
  // GEMINI MESSAGE HANDLER
  // ===================================================

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
      message.error
    ) {
      setStatus(
        message.error.message ||
        "Gemini Live xatosi."
      );

      return;
    }


    if (
      message.setupComplete
    ) {
      ready = true;

      setStatus(
        "Ustoz tayyor — gaplashing...",
        true
      );

      ws.send(
        JSON.stringify({
          clientContent: {
            turns: [
              {
                role:
                  "user",

                parts: [
                  {
                    text:
                      "Suhbatni hozir boshlang. Salomlashing va IELTS Speaking Part 1 uchun bitta savol bering."
                  }
                ]
              }
            ],

            turnComplete:
              true
          }
        })
      );

      return;
    }


    const content =
      message.serverContent;

    if (!content) {
      return;
    }


    // Model javobi o'quvchi
    // gapirganda to'xtatilsa
    if (
      content.interrupted
    ) {
      outputTime =
        ctx?.currentTime ||
        0;

      setStatus(
        "Siz gapiryapsiz...",
        true
      );
    }


    // O'quvchi ovozi
    if (
      content
        .interimInputTranscription
        ?.text
    ) {
      if (!userLine) {
        userLine =
          addLine(
            "Siz",
            content
              .interimInputTranscription
              .text
          );
      } else {
        updateLine(
          userLine,

          content
            .interimInputTranscription
            .text
        );
      }
    }


    // O'quvchi yakuniy transcript
    if (
      content
        .inputTranscription
        ?.text
    ) {
      if (!userLine) {
        userLine =
          addLine(
            "Siz",
            content
              .inputTranscription
              .text
          );
      } else {
        updateLine(
          userLine,

          content
            .inputTranscription
            .text
        );
      }
    }


    // AI transcript
    if (
      content
        .outputTranscription
        ?.text
    ) {
      if (!aiLine) {
        aiLine =
          addLine(
            "AI Ustoz",
            content
              .outputTranscription
              .text
          );
      } else {
        updateLine(
          aiLine,

          content
            .outputTranscription
            .text
        );
      }
    }


    // AI audio
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
          playPCM(
            part.inlineData.data
          );
        }
      }
    }


    // Turn tugadi
    if (
      content.turnComplete
    ) {
      userLine = null;
      aiLine = null;

      setStatus(
        "Ustoz tinglayapti...",
        true
      );
    }
  }


  // ===================================================
  // GEMINI WEBSOCKET
  // ===================================================

  function openSocket(
    auth
  ) {
    return new Promise(
      (
        resolve,
        reject
      ) => {

        const url =
          "wss://generativelanguage.googleapis.com/ws/" +
          "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained" +
          "?access_token=" +
          encodeURIComponent(
            auth.token
          );


        ws =
          new WebSocket(
            url
          );


        let settled =
          false;


        ws.onopen =
          () => {
            sendSetup(
              auth.model,
              auth.voice
            );
          };


        ws.onmessage =
          event => {
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
              message.setupComplete &&
              !settled
            ) {
              settled =
                true;

              resolve();
            }


            handleMessage(
              event.data
            );
          };


        ws.onerror =
          () => {
            if (
              !settled
            ) {
              settled =
                true;

              reject(
                new Error(
                  "Gemini Live WebSocket ulanilmadi."
                )
              );
            }
          };


        ws.onclose =
          event => {
            ready =
              false;

            if (
              !settled
            ) {
              settled =
                true;

              reject(
                new Error(
                  `Gemini Live ulanish yopildi (${event.code}).`
                )
              );
            }

            if (
              running
            ) {
              stop(false);
            }
          };
      }
    );
  }


  // ===================================================
  // MICROPHONE
  // ===================================================

  async function openMicrophone() {
    stream =
      await navigator
        .mediaDevices
        .getUserMedia({
          audio: {
            channelCount:
              1,

            echoCancellation:
              true,

            noiseSuppression:
              true,

            autoGainControl:
              true
          }
        });


    ctx =
      new AudioContext();

    await ctx.resume();


    source =
      ctx.createMediaStreamSource(
        stream
      );


    processor =
      ctx.createScriptProcessor(
        4096,
        1,
        1
      );


    mute =
      ctx.createGain();

    mute.gain.value =
      0;


    processor.onaudioprocess =
      event => {

        if (
          !running ||
          !ready ||
          !ws ||
          ws.readyState !==
            WebSocket.OPEN
        ) {
          return;
        }


        const input =
          new Float32Array(
            event.inputBuffer
              .getChannelData(
                0
              )
          );


        const data16k =
          downsample(
            input,
            ctx.sampleRate
          );


        const bytes =
          pcm16(
            data16k
          );


        ws.send(
          JSON.stringify({
            realtimeInput: {
              audio: {
                data:
                  base64FromBytes(
                    bytes
                  ),

                mimeType:
                  "audio/pcm;rate=16000"
              }
            }
          })
        );
      };


    source.connect(
      processor
    );

    processor.connect(
      mute
    );

    mute.connect(
      ctx.destination
    );
  }


  // ===================================================
  // TIMER
  // ===================================================

  function startTimer() {
    startedAt =
      Date.now();

    clearInterval(
      timer
    );

    timer =
      setInterval(
        () => {
          const seconds =
            Math.floor(
              (
                Date.now() -
                startedAt
              ) / 1000
            );

          const minutes =
            Math.floor(
              seconds / 60
            );

          const rest =
            seconds % 60;

          ui.timer.textContent =
            `${String(
              minutes
            ).padStart(
              2,
              "0"
            )}:${String(
              rest
            ).padStart(
              2,
              "0"
            )}`;
        },

        1000
      );
  }


  function stopTimer() {
    clearInterval(
      timer
    );

    timer = null;
  }


  // ===================================================
  // START
  // ===================================================

  async function start() {
    if (running) {
      return;
    }


    if (
      !navigator
        .mediaDevices
        ?.getUserMedia
    ) {
      setStatus(
        "Brauzer mikrofonni qo'llab-quvvatlamaydi."
      );

      return;
    }


    if (
      !window.isSecureContext &&
      location.hostname !==
        "localhost"
    ) {
      setStatus(
        "Mikrofon uchun HTTPS kerak."
      );

      return;
    }


    running =
      true;

    ready =
      false;

    outputTime =
      0;

    userLine =
      null;

    aiLine =
      null;


    setButton(
      true
    );

    setStatus(
      "Ustozga ulanmoqda...",
      true
    );

    startTimer();


    try {

      const auth =
        await getToken();


      await openSocket(
        auth
      );


      await openMicrophone();


      setStatus(
        "Ustoz tinglayapti...",
        true
      );

    } catch (error) {

      console.error(
        error
      );

      setStatus(
        error.message ||
        "Live Speaking ishga tushmadi."
      );

      await stop(
        false
      );
    }
  }


  // ===================================================
  // STOP
  // ===================================================

  async function stop(
    showStatus = true
  ) {
    running =
      false;

    ready =
      false;


    stopTimer();

    setButton(
      false
    );


    if (ui.timer) {
      ui.timer.textContent =
        "00:00";
    }


    try {
      processor?.disconnect();
    } catch {}

    processor =
      null;


    try {
      source?.disconnect();
    } catch {}

    source =
      null;


    try {
      mute?.disconnect();
    } catch {}

    mute =
      null;


    if (stream) {
      stream
        .getTracks()
        .forEach(
          track =>
            track.stop()
        );

      stream =
        null;
    }


    if (ws) {

      try {
        if (
          ws.readyState ===
          WebSocket.OPEN
        ) {
          ws.send(
            JSON.stringify({
              realtimeInput: {
                audioStreamEnd:
                  true
              }
            })
          );
        }
      } catch {}


      try {
        ws.close();
      } catch {}


      ws =
        null;
    }


    if (ctx) {
      try {
        await ctx.close();
      } catch {}

      ctx =
        null;
    }


    outputTime =
      0;


    if (showStatus) {
      setStatus(
        "Suhbat tugadi."
      );
    }
  }


  // ===================================================
  // INIT
  // ===================================================

  function init() {
    buildUI();
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


  window.addEventListener(
    "beforeunload",
    () => {

      if (stream) {
        stream
          .getTracks()
          .forEach(
            track =>
              track.stop()
          );
      }

      try {
        ws?.close();
      } catch {}
    }
  );
})();
