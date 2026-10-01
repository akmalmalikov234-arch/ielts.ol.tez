const $ = selector =>
  document.querySelector(selector);

const $$ = selector =>
  [...document.querySelectorAll(selector)];


const state = {

  target: null,

  deadline: "",

  level: "A2-B1",

  speakingQuestion:
    "What do you usually do in your free time?",

  recording: false,

  recorder: null,

  chunks: [],

  audioBlob: null,

  transcript: "",

  history: [],

  diagnosticAnswers: [],

  live: {

    socket: null,

    stream: null,

    audioContext: null,

    processor: null,

    source: null,

    playbackContext: null,

    playbackTime: 0,

    running: false,

    setupComplete: false,

    stopped: false

  }

};


/* =====================================================
   SECURITY
===================================================== */

function escapeHTML(value) {

  return String(value)
    .replace(
      /[&<>"']/g,
      character => {

        const map = {

          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"

        };

        return map[
          character
        ];

      }
    );

}


/* =====================================================
   TOAST
===================================================== */

function toast(message) {

  const element =
    $("#toast");

  if (!element) {
    return;
  }

  element.textContent =
    message;

  element.classList.add(
    "show"
  );

  setTimeout(
    () => {

      element.classList.remove(
        "show"
      );

    },

    3000
  );

}


/* =====================================================
   TABS
===================================================== */

function openTab(name) {

  $$(".tab")
    .forEach(
      tab => {

        tab.classList.remove(
          "active"
        );

      }
    );


  const selected =
    $("#" + name);


  if (selected) {

    selected.classList.add(
      "active"
    );

  }


  $$(".nav-button")
    .forEach(
      button => {

        button.classList.toggle(
          "active",

          button.dataset.tab ===
          name
        );

      }
    );


  if (
    name ===
    "speaking"
  ) {

    ensureLiveUI();

  }

}


$$(".nav-button")
  .forEach(
    button => {

      button.addEventListener(
        "click",

        () => {

          openTab(
            button.dataset.tab
          );

        }
      );

    }
  );


/* =====================================================
   HERO
===================================================== */

$("#startBtn")
  ?.addEventListener(
    "click",

    () => {

      $("#diagnosticStart")
        ?.scrollIntoView({
          behavior:
            "smooth",

          block:
            "center"
        });

    }
  );


$("#demoBtn")
  ?.addEventListener(
    "click",

    () => {

      openTab(
        "chat"
      );

      if (
        $("#chatInput")
      ) {

        $("#chatInput")
          .value =
          "Ustoz, IELTS 8.0 olish uchun qayerdan boshlayman?";

        sendChat();

      }

    }
  );


/* =====================================================
   TARGET
===================================================== */

$$(
  ".target-buttons button"
)
  .forEach(
    button => {

      button.addEventListener(
        "click",

        () => {

          $$(
            ".target-buttons button"
          )
            .forEach(
              item => {

                item.classList.remove(
                  "selected"
                );

              }
            );


          button.classList.add(
            "selected"
          );


          state.target =
            button.dataset.target;


          if (
            $("#targetBand")
          ) {

            $("#targetBand")
              .textContent =
              state.target;

          }

        }
      );

    }
  );


/* =====================================================
   DIAGNOSTIC
===================================================== */

const diagnosticQuestions = [

  {

    question:
      "IELTSdan hozir taxminan nechchi olasiz?",

    options: [
      "4.0–4.5",
      "5.0–5.5",
      "6.0–6.5",
      "7.0+"
    ]

  },

  {

    question:
      "Kuniga real qancha vaqt ajrata olasiz?",

    options: [
      "15–30 daqiqa",
      "1 soat",
      "2 soat",
      "3+ soat"
    ]

  },

  {

    question:
      "Qaysi skill eng qiyin?",

    options: [
      "Listening",
      "Reading",
      "Writing",
      "Speaking"
    ]

  },

  {

    question:
      "Inglizcha gapirishga munosabatingiz?",

    options: [
      "Gapirishdan qo‘rqaman",
      "Oddiy gapiraman",
      "Erkinroq gapiraman",
      "Bemalol gaplashaman"
    ]

  }

];


let diagnosticIndex = 0;


$("#diagnosticStart")
  ?.addEventListener(
    "click",
    startDiagnostic
  );


$("#closeModal")
  ?.addEventListener(
    "click",

    () => {

      $("#diagnosticModal")
        ?.classList.add(
          "hidden"
        );

    }
  );


function startDiagnostic() {

  if (
    !state.target
  ) {

    toast(
      "Avval maqsad balingizni tanlang 😌"
    );

    return;

  }


  state.deadline =
    $("#deadline")
      ?.value
      .trim() ||
    "aniq emas";


  diagnosticIndex =
    0;


  state.diagnosticAnswers =
    [];


  $("#diagnosticModal")
    ?.classList.remove(
      "hidden"
    );


  renderDiagnostic();

}


function renderDiagnostic() {

  const container =
    $("#diagStep");


  if (!container) {
    return;
  }


  if (
    diagnosticIndex >=
    diagnosticQuestions.length
  ) {

    container.innerHTML = `

      <div class="small-label">
        YAKUN
      </div>

      <h2>
        Ustoz hisoblayapti...
      </h2>

      <p style="color:#8d98b4">
        Hozircha qochib ketmang. 😌
      </p>

    `;


    submitDiagnostic();

    return;

  }


  const question =
    diagnosticQuestions[
      diagnosticIndex
    ];


  container.innerHTML = `

    <div class="small-label">
      SAVOL
      ${diagnosticIndex + 1}
      /
      ${diagnosticQuestions.length}
    </div>

    <div class="diag-q">
      ${escapeHTML(
        question.question
      )}
    </div>

    <div class="diag-options">

      ${question.options
        .map(
          (
            option,
            index
          ) => `

            <button
              data-index="${index}"
            >
              ${escapeHTML(
                option
              )}
            </button>

          `
        )
        .join("")}

    </div>

  `;


  container
    .querySelectorAll(
      "button"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",

          () => {

            const index =
              Number(
                button.dataset.index
              );


            state
              .diagnosticAnswers
              .push({

                question:
                  question.question,

                answer:
                  question.options[
                    index
                  ]

              });


            diagnosticIndex +=
              1;


            renderDiagnostic();

          }
        );

      }
    );

}


async function submitDiagnostic() {

  try {

    const response =
      await fetch(
        "/api/diagnostic",

        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify({

              profile: {

                target:
                  state.target,

                deadline:
                  state.deadline,

                level:
                  state.level

              },

              answers:
                state.diagnosticAnswers

            })

        }
      );


    const data =
      await response.json();


    if (
      !response.ok
    ) {

      throw new Error(
        data.error ||
        "Diagnostika xatosi"
      );

    }


    $("#diagnosticModal")
      ?.classList.add(
        "hidden"
      );


    const band =
      Number(
        data.band ||
        0
      );


    if (
      $("#statBand")
    ) {

      $("#statBand")
        .textContent =
        band.toFixed(1);

    }


    if (
      $("#targetBand")
    ) {

      $("#targetBand")
        .textContent =
        state.target;

    }


    if (
      $("#sideLevel")
    ) {

      $("#sideLevel")
        .textContent =
        `Taxminiy: ${band.toFixed(1)}`;

    }


    if (
      $("#progressBar")
    ) {

      const target =
        Number(
          state.target
        );


      const percentage =
        Math.min(
          100,

          Math.max(
            5,

            (
              band /
              target
            ) *
            100
          )
        );


      $("#progressBar")
        .style.width =
        percentage +
        "%";

    }


    if (
      $("#progressText")
    ) {

      $("#progressText")
        .textContent =
        data.message ||
        "Reja tayyor.";

    }


    toast(
      "Diagnostika tugadi. Endi ustoz qochirmaydi 😌"
    );

  } catch (error) {

    $("#diagnosticModal")
      ?.classList.add(
        "hidden"
      );


    toast(
      error.message
    );

  }

}


/* =====================================================
   LIVE SPEAKING STYLE
===================================================== */

function ensureLiveStyles() {

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

      margin:
        0 0 20px;

      padding:
        24px;

      border:
        1px solid
        rgba(
          200,
          255,
          66,
          .22
        );

      border-radius:
        18px;

      background:
        linear-gradient(
          180deg,
          rgba(
            200,
            255,
            66,
            .055
          ),
          rgba(
            8,
            12,
            25,
            .2
          )
        );

      box-shadow:
        0 0 35px
        rgba(
          200,
          255,
          66,
          .04
        );

    }


    .live-speaking-head {

      display:
        flex;

      align-items:
        center;

      justify-content:
        space-between;

      gap:
        16px;

    }


    .live-speaking-title {

      display:
        flex;

      align-items:
        center;

      gap:
        14px;

    }


    .live-orb {

      width:
        48px;

      height:
        48px;

      border-radius:
        50%;

      display:
        grid;

      place-items:
        center;

      background:
        #c8ff42;

      color:
        #071008;

      font-weight:
        900;

      box-shadow:
        0 0 0 7px
        rgba(
          200,
          255,
          66,
          .08
        ),

        0 0 28px
        rgba(
          200,
          255,
          66,
          .24
        );

    }


    .live-orb.live-pulse {

      animation:
        livePulse
        1.35s
        infinite;

    }


    @keyframes livePulse {

      0%,
      100% {

        transform:
          scale(1);

      }

      50% {

        transform:
          scale(1.08);

      }

    }


    .live-status {

      font-size:
        13px;

      color:
        #8d98b4;

      margin-top:
        4px;

    }


    .live-status.ok {

      color:
        #c8ff42;

    }


    .live-status.err {

      color:
        #ff7184;

    }


    .live-actions {

      display:
        flex;

      gap:
        10px;

      flex-wrap:
        wrap;

      margin-top:
        20px;

    }


    .live-button {

      border:
        0;

      border-radius:
        12px;

      padding:
        12px 18px;

      font-weight:
        800;

      cursor:
        pointer;

      background:
        #c8ff42;

      color:
        #071008;

    }


    .live-button:disabled {

      opacity:
        .4;

      cursor:
        not-allowed;

    }


    .live-button.stop {

      background:
        rgba(
          255,
          113,
          132,
          .12
        );

      color:
        #ff7184;

      border:
        1px solid
        rgba(
          255,
          113,
          132,
          .2
        );

    }


    .live-transcript {

      margin-top:
        18px;

      min-height:
        64px;

      padding:
        14px;

      border-radius:
        12px;

      background:
        rgba(
          255,
          255,
          255,
          .025
        );

      border:
        1px solid
        rgba(
          255,
          255,
          255,
          .06
        );

      color:
        #b7c0d7;

      white-space:
        pre-wrap;

    }


    .live-help {

      margin-top:
        12px;

      color:
        #6f7b96;

      font-size:
        12px;

      line-height:
        1.5;

    }

  `;


  document.head.appendChild(
    style
  );

}


/* =====================================================
   LIVE SPEAKING UI
===================================================== */

function ensureLiveUI() {

  ensureLiveStyles();


  const speaking =
    $("#speaking");


  if (
    !speaking ||
    $("#liveSpeakingCard")
  ) {

    return;

  }


  const card =
    document.createElement(
      "article"
    );


  card.className =
    "live-speaking-card";


  card.id =
    "liveSpeakingCard";


  card.innerHTML = `

    <div
      class="live-speaking-head"
    >

      <div
        class="live-speaking-title"
      >

        <div
          class="live-orb"
          id="liveOrb"
        >
          ●
        </div>

        <div>

          <div
            class="small-label"
          >
            JONLI SPEAKING
          </div>

          <h3
            style="margin:3px 0 0"
          >
            Live IELTS Ustoz
          </h3>

          <div
            class="live-status"
            id="liveStatus"
          >
            Tayyor.
            Mikrofonni yoqing.
          </div>

        </div>

      </div>


      <div
        class="tag"
        id="liveBadge"
      >
        TAYYOR
      </div>

    </div>


    <div
      class="live-actions"
    >

      <button
        class="live-button"
        id="liveStartBtn"
      >
        🎙 Jonli suhbatni boshlash
      </button>


      <button
        class="live-button stop"
        id="liveStopBtn"
        disabled
      >
        ■ To‘xtatish
      </button>

    </div>


    <div
      class="live-transcript"
      id="liveTranscript"
    >
      Ustozning savoli shu yerda
      ko‘rinadi.
      Suhbat davomida sizning
      gaplaringiz ham matn
      ko‘rinishida chiqadi.
    </div>


    <div
      class="live-help"
    >
      Telefon kabi gaplashing:
      mikrofonni yoqing,
      savolga inglizcha javob
      bering va tabiiy pauza qiling.
      Ustoz qisqa gapiradi va
      navbatni sizga beradi.
    </div>

  `;


  const questionCard =
    speaking.querySelector(
      ".question-card"
    );


  speaking.insertBefore(
    card,

    questionCard ||
    speaking.firstChild
  );


  $("#liveStartBtn")
    .addEventListener(
      "click",
      startLiveSpeaking
    );


  $("#liveStopBtn")
    .addEventListener(
      "click",
      stopLiveSpeaking
    );

}


function setLiveStatus(
  text,
  type = ""
) {

  const element =
    $("#liveStatus");


  const badge =
    $("#liveBadge");


  if (element) {

    element.textContent =
      text;

    element.className =
      `live-status ${type}`.trim();

  }


  if (badge) {

    if (
      type ===
      "err"
    ) {

      badge.textContent =
        "XATO";

    } else if (
      state.live.running
    ) {

      badge.textContent =
        "ONLINE";

    } else {

      badge.textContent =
        "TAYYOR";

    }

  }

}


function appendLiveText(
  prefix,
  text
) {

  const box =
    $("#liveTranscript");


  if (
    !box ||
    !text
  ) {

    return;

  }


  const clean =
    String(
      text
    ).trim();


  if (!clean) {
    return;
  }


  box.textContent =
    `${prefix}: ${clean}`;

}


/* =====================================================
   START LIVE
===================================================== */

async function startLiveSpeaking() {

  if (
    state.live.running
  ) {

    return;

  }


  ensureLiveUI();


  setLiveStatus(
    "Ulanmoqda..."
  );


  if (
    $("#liveStartBtn")
  ) {

    $("#liveStartBtn")
      .disabled =
      true;

  }


  try {

    if (
      !navigator
        .mediaDevices
        ?.getUserMedia
    ) {

      throw new Error(
        "Brauzer mikrofonni qo‘llamayapti."
      );

    }


    const tokenResponse =
      await fetch(
        "/api/live-token",

        {
          method:
            "POST"
        }
      );


    const tokenData =
      await tokenResponse.json();


    if (
      !tokenResponse.ok ||
      !tokenData.token
    ) {

      throw new Error(
        tokenData.error ||
        "Gemini Live token olinmadi."
      );

    }


    const wsUrl =

      "wss://generativelanguage.googleapis.com/" +

      "ws/google.ai.generativelanguage.v1beta." +

      "GenerativeService." +

      "BidiGenerateContentConstrained" +

      "?access_token=" +

      encodeURIComponent(
        tokenData.token
      );


    const socket =
      new WebSocket(
        wsUrl
      );


    state.live.socket =
      socket;


    state.live.stopped =
      false;


    socket.onopen =
      async () => {

        const setup = {

          setup: {

            model:
              `models/${
                tokenData.model ||
                "gemini-3.8-live"
              }`,

            responseModalities:
              ["AUDIO"],

            inputAudioTranscription:
              {},

            outputAudioTranscription:
              {},

            realtimeInputConfig: {

              automaticActivityDetection: {

                disabled:
                  false,

                prefixPaddingMs:
                  120,

                silenceDurationMs:
                  650

              }

            },

            systemInstruction: {

              parts: [

                {

                  text: `

Sen Live IELTS Ustozsan.

O'quvchi bilan telefon
orqali gaplashayotgandek
tabiiy suhbat qil.

Asosiy suhbat tili:
INGLIZ TILI.

O'quvchi qiynalsa yoki
o'zbekcha so'rasa,
qisqa O'ZBEKCHA tushuntirish
ber va keyin inglizchaga qayt.

IELTS Speaking Part 1,
Part 2 va Part 3 uslubida
mashq qil.

Bir vaqtning o'zida
BITTA savol ber.

Savolni bergandan keyin
o'quvchining javobini kut.

Uzoq monolog qilma.

Ovoz ohanging:
sokin,
do'stona,
aniq.

O'quvchini gap o'rtasida
keraksiz to'xtatma.

Javobdan keyin tabiiy
follow-up savol ber.

Zarur bo'lsa grammatik
yoki vocabulary xatosini
juda qisqa tuzat.

Rasmiy IELTS ballini
berayotganingni da'vo qilma.

Suhbatni o'zing boshlagin.

Avval qisqa salomlash.

Keyin IELTS Speaking
Part 1 dan bitta savol ber.

                  `.trim()

                }

              ]

            }

          }

        };


        socket.send(
          JSON.stringify(
            setup
          )
        );


        state.live.running =
          true;


        state.live.setupComplete =
          false;


        if (
          $("#liveStopBtn")
        ) {

          $("#liveStopBtn")
            .disabled =
            false;

        }


        $("#liveOrb")
          ?.classList.add(
            "live-pulse"
          );


        setLiveStatus(
          "Ustoz ulanmoqda...",
          "ok"
        );


        await startLiveMicrophone();

      };


    socket.onmessage =
      event => {

        handleLiveMessage(
          event.data
        );

      };


    socket.onerror =
      () => {

        setLiveStatus(
          "Gemini Live ulanishida xato.",
          "err"
        );

      };


    socket.onclose =
      () => {

        state.live.running =
          false;


        state.live.setupComplete =
          false;


        stopLiveMicrophoneOnly();


        if (
          $("#liveStopBtn")
        ) {

          $("#liveStopBtn")
            .disabled =
            true;

        }


        if (
          $("#liveStartBtn")
        ) {

          $("#liveStartBtn")
            .disabled =
            false;

        }


        $("#liveOrb")
          ?.classList.remove(
            "live-pulse"
          );


        if (
          !state.live.stopped
        ) {

          setLiveStatus(
            "Ulanish yopildi.",
            "err"
          );

        }

      };


  } catch (error) {

    await stopLiveSpeaking();


    if (
      $("#liveStartBtn")
    ) {

      $("#liveStartBtn")
        .disabled =
        false;

    }


    setLiveStatus(
      error.message ||
      "Live ishlamadi.",
      "err"
    );


    toast(
      error.message ||
      "Live ishlamadi."
    );

  }

}


/* =====================================================
   MICROPHONE
===================================================== */

async function startLiveMicrophone() {

  const stream =
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


  state.live.stream =
    stream;


  const context =
    new AudioContext();


  state.live.audioContext =
    context;


  await context.resume();


  const source =
    context
      .createMediaStreamSource(
        stream
      );


  const processor =
    context
      .createScriptProcessor(
        4096,
        1,
        1
      );


  state.live.source =
    source;


  state.live.processor =
    processor;


  processor.onaudioprocess =
    event => {

      if (
        !state.live.running ||
        !state.live.socket ||
        state.live.socket.readyState !==
          WebSocket.OPEN
      ) {

        return;

      }


      const input =
        event
          .inputBuffer
          .getChannelData(
            0
          );


      const pcm =
        downsampleTo16k(
          input,
          context.sampleRate
        );


      const base64 =
        int16ToBase64(
          pcm
        );


      if (!base64) {
        return;
      }


      state.live.socket.send(

        JSON.stringify({

          realtimeInput: {

            audio: {

              data:
                base64,

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
    context.destination
  );


  setLiveStatus(
    "Ustoz tinglayapti. Gapiring...",
    "ok"
  );

}


/* =====================================================
   PCM CONVERSION
===================================================== */

function downsampleTo16k(
  input,
  inputRate
) {

  if (
    inputRate ===
    16000
  ) {

    const output =
      new Int16Array(
        input.length
      );


    for (
      let i = 0;
      i < input.length;
      i++
    ) {

      output[i] =
        floatToInt16(
          input[i]
        );

    }


    return output;

  }


  const ratio =
    inputRate /
    16000;


  const outputLength =
    Math.max(
      1,

      Math.round(
        input.length /
        ratio
      )
    );


  const output =
    new Int16Array(
      outputLength
    );


  for (
    let i = 0;
    i < outputLength;
    i++
  ) {

    const start =
      Math.floor(
        i * ratio
      );


    const end =
      Math.min(
        Math.floor(
          (i + 1) *
          ratio
        ),

        input.length
      );


    let sum =
      0;


    let count =
      0;


    for (
      let j = start;
      j < end;
      j++
    ) {

      sum +=
        input[j];

      count++;

    }


    const value =
      count
        ? sum / count
        : input[
            Math.min(
              start,
              input.length -
              1
            )
          ] || 0;


    output[i] =
      floatToInt16(
        value
      );

  }


  return output;

}


function floatToInt16(
  value
) {

  const sample =
    Math.max(
      -1,

      Math.min(
        1,
        value
      )
    );


  return sample < 0

    ? sample * 0x8000

    : sample * 0x7fff;

}


function int16ToBase64(
  samples
) {

  const bytes =
    new Uint8Array(
      samples.buffer,
      samples.byteOffset,
      samples.byteLength
    );


  let binary =
    "";


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

          Math.min(
            i + chunk,
            bytes.length
          )
        )
      );

  }


  return btoa(
    binary
  );

}


function base64ToInt16(
  base64
) {

  const binary =
    atob(
      base64
    );


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
      binary.charCodeAt(
        i
      );

  }


  return new Int16Array(
    bytes.buffer
  );

}


/* =====================================================
   LIVE MESSAGE
===================================================== */

function handleLiveMessage(
  raw
) {

  let message;


  try {

    message =
      JSON.parse(
        raw
      );

  } catch {

    return;

  }


  if (
    message.setupComplete
  ) {

    state.live.setupComplete =
      true;


    setLiveStatus(
      "Ustoz tayyor. Gapiring...",
      "ok"
    );


    const socket =
      state.live.socket;


    if (
      socket &&
      socket.readyState ===
        WebSocket.OPEN
    ) {

      socket.send(

        JSON.stringify({

          clientContent: {

            turns: [

              {

                role:
                  "user",

                parts: [

                  {

                    text:
                      "Start the IELTS speaking practice now."

                  }

                ]

              }

            ],

            turnComplete:
              true

          }

        })

      );

    }

  }


  const content =
    message.serverContent;


  if (!content) {
    return;
  }


  if (
    content
      .inputTranscription
      ?.text
  ) {

    appendLiveText(
      "Siz",
      content
        .inputTranscription
        .text
    );

  }


  if (
    content
      .outputTranscription
      ?.text
  ) {

    appendLiveText(
      "Ustoz",
      content
        .outputTranscription
        .text
    );

  }


  if (
    content.interrupted
  ) {

    stopQueuedPlayback();

  }


  const parts =
    content
      .modelTurn
      ?.parts ||
    [];


  for (
    const part of parts
  ) {

    if (
      part
        .inlineData
        ?.data
    ) {

      playLivePcm(
        part.inlineData.data,
        24000
      );

    }

  }


  if (
    content.turnComplete
  ) {

    setLiveStatus(
      "Ustoz tugatdi. Navbat sizda...",
      "ok"
    );

  }

}


/* =====================================================
   LIVE AUDIO PLAYBACK
===================================================== */

function getPlaybackContext() {

  if (
    !state.live.playbackContext
  ) {

    state.live.playbackContext =
      new AudioContext({
        sampleRate:
          24000
      });


    state.live.playbackTime =
      state
        .live
        .playbackContext
        .currentTime;

  }


  return state
    .live
    .playbackContext;

}


function playLivePcm(
  base64,
  sampleRate
) {

  try {

    const context =
      getPlaybackContext();


    const samples =
      base64ToInt16(
        base64
      );


    if (
      !samples.length
    ) {

      return;

    }


    const buffer =
      context.createBuffer(
        1,
        samples.length,
        sampleRate
      );


    const channel =
      buffer.getChannelData(
        0
      );


    for (
      let i = 0;
      i < samples.length;
      i++
    ) {

      channel[i] =
        samples[i] /
        32768;

    }


    const source =
      context
        .createBufferSource();


    source.buffer =
      buffer;


    source.connect(
      context.destination
    );


    const now =
      context.currentTime;


    if (
      state.live.playbackTime <
      now
    ) {

      state.live.playbackTime =
        now;

    }


    source.start(
      state.live.playbackTime
    );


    state.live.playbackTime +=
      buffer.duration;


    setLiveStatus(
      "Ustoz gapiryapti...",
      "ok"
    );

  } catch (error) {

    console.error(
      error
    );

  }

}


function stopQueuedPlayback() {

  if (
    state.live.playbackContext
  ) {

    try {

      state
        .live
        .playbackContext
        .close();

    } catch {}

    state.live.playbackContext =
      null;

    state.live.playbackTime =
      0;

  }

}


/* =====================================================
   STOP MICROPHONE
===================================================== */

function stopLiveMicrophoneOnly() {

  try {

    state.live
      .processor
      ?.disconnect();

  } catch {}


  try {

    state.live
      .source
      ?.disconnect();

  } catch {}


  state.live.processor =
    null;


  state.live.source =
    null;


  if (
    state.live.stream
  ) {

    state.live.stream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

  }


  state.live.stream =
    null;


  if (
    state.live.audioContext
  ) {

    try {

      state
        .live
        .audioContext
        .close();

    } catch {}

    state.live.audioContext =
      null;

  }

}


/* =====================================================
   STOP LIVE
===================================================== */

async function stopLiveSpeaking() {

  state.live.stopped =
    true;


  stopLiveMicrophoneOnly();


  stopQueuedPlayback();


  if (
    state.live.socket
  ) {

    try {

      state.live.socket.close(
        1000,
        "user stopped"
      );

    } catch {}

  }


  state.live.socket =
    null;


  state.live.running =
    false;


  state.live.setupComplete =
    false;


  if (
    $("#liveStartBtn")
  ) {

    $("#liveStartBtn")
      .disabled =
      false;

  }


  if (
    $("#liveStopBtn")
  ) {

    $("#liveStopBtn")
      .disabled =
      true;

  }


  $("#liveOrb")
    ?.classList.remove(
      "live-pulse"
    );


  setLiveStatus(
    "To‘xtatildi. Qayta boshlashingiz mumkin.",
    ""
  );

}


/* =====================================================
   ORDINARY SPEAKING RECORDER
===================================================== */

let timerInterval =
  null;

let startedAt =
  null;


$("#recordBtn")
  ?.addEventListener(
    "click",

    async () => {

      if (
        state.recording
      ) {

        stopRecording();

      } else {

        await startRecording();

      }

    }
  );


async function startRecording() {

  try {

    const stream =
      await navigator
        .mediaDevices
        .getUserMedia({
          audio:
            true
        });


    state.chunks =
      [];


    const mimeType =
      MediaRecorder
        .isTypeSupported(
          "audio/webm"
        )

        ? "audio/webm"

        : "audio/mp4";


    state.recorder =
      new MediaRecorder(
        stream,
        {
          mimeType
        }
      );


    state
      .recorder
      .ondataavailable =
      event => {

        if (
          event.data &&
          event.data.size
        ) {

          state.chunks
            .push(
              event.data
            );

        }

      };


    state.recorder.onstop =
      () => {

        state.audioBlob =
          new Blob(
            state.chunks,
            {
              type:
                mimeType
            }
          );


        stream
          .getTracks()
          .forEach(
            track =>
              track.stop()
          );


        transcribeAudio();

      };


    state.recorder.start();


    state.recording =
      true;


    startedAt =
      Date.now();


    timerInterval =
      setInterval(
        updateTimer,
        200
      );


    $(".recorder")
      ?.classList.add(
        "recording"
      );


    if (
      $("#recordState")
    ) {

      $("#recordState")
        .textContent =
        "Yozilmoqda";

    }


    if (
      $("#recordHint")
    ) {

      $("#recordHint")
        .textContent =
        "Tugatish uchun mikrofonni bosing";

    }

  } catch {

    toast(
      "Mikrofonga ruxsat berilmadi."
    );

  }

}


function stopRecording() {

  state.recording =
    false;


  clearInterval(
    timerInterval
  );


  if (
    state.recorder &&
    state.recorder.state !==
      "inactive"
  ) {

    state.recorder.stop();

  }


  $(".recorder")
    ?.classList.remove(
      "recording"
    );


  if (
    $("#recordState")
  ) {

    $("#recordState")
      .textContent =
      "Tahlil qilinmoqda";

  }


  if (
    $("#recordHint")
  ) {

    $("#recordHint")
      .textContent =
      "Audio matnga aylantirilmoqda...";

  }

}


function updateTimer() {

  const seconds =
    Math.floor(
      (
        Date.now() -
        startedAt
      ) /
      1000
    );


  const minutes =
    Math.floor(
      seconds /
      60
    );


  const rest =
    seconds %
    60;


  if (
    $("#timer")
  ) {

    $("#timer")
      .textContent =

      String(
        minutes
      )
        .padStart(
          2,
          "0"
        )

      +

      ":" +

      String(
        rest
      )
        .padStart(
          2,
          "0"
        );

  }

}


/* =====================================================
   TRANSCRIBE
===================================================== */

async function transcribeAudio() {

  try {

    const form =
      new FormData();


    form.append(
      "audio",

      state.audioBlob,

      "speaking.webm"
    );


    const response =
      await fetch(
        "/api/transcribe",

        {
          method:
            "POST",

          body:
            form

        }
      );


    const data =
      await response.json();


    if (
      !response.ok
    ) {

      throw new Error(
        data.error ||
        "Transkripsiya xatosi"
      );

    }


    state.transcript =
      data.text ||
      "";


    if (
      $("#transcript")
    ) {

      $("#transcript")
        .textContent =
        state.transcript ||
        "Ovoz aniqlanmadi.";

    }


    if (
      $("#gradeBtn")
    ) {

      $("#gradeBtn")
        .disabled =
        !state.transcript;

    }


    if (
      $("#recordState")
    ) {

      $("#recordState")
        .textContent =
        "Tayyor";

    }


    if (
      $("#recordHint")
    ) {

      $("#recordHint")
        .textContent =
        "Javobingizni tekshirish mumkin";

    }

  } catch (error) {

    toast(
      error.message
    );


    if (
      $("#recordState")
    ) {

      $("#recordState")
        .textContent =
        "Xatolik";

    }

  }

}


/* =====================================================
   SPEAKING GRADE
===================================================== */

$("#gradeBtn")
  ?.addEventListener(
    "click",
    gradeSpeaking
  );


async function gradeSpeaking() {

  const button =
    $("#gradeBtn");


  if (!button) {
    return;
  }


  button.disabled =
    true;


  button.textContent =
    "Ustoz tekshiryapti...";


  try {

    const response =
      await fetch(
        "/api/speaking/grade",

        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify({

              question:
                state.speakingQuestion,

              transcript:
                state.transcript,

              profile: {

                target:
                  state.target ||
                  "7.0"

              }

            })

        }
      );


    const data =
      await response.json();


    if (
      !response.ok
    ) {

      throw new Error(
        data.error ||
        "Baholash xatosi"
      );

    }


    const band =
      Number(
        data.band ||
        0
      );


    $("#speakingResult")
      ?.classList.remove(
        "hidden"
      );


    if (
      $("#speakingResult")
    ) {

      $("#speakingResult")
        .innerHTML = `

          <div class="small-label">
            USTOZ XULOSASI
          </div>

          <div class="band">
            ${band.toFixed(1)}
          </div>

          <h3>
            ${escapeHTML(
              data.message ||
              ""
            )}
          </h3>

          <strong>
            Kuchli tomonlar
          </strong>

          <ul>

            ${(data.strengths || [])
              .map(
                item =>
                  `<li>
                    ${escapeHTML(
                      item
                    )}
                  </li>`
              )
              .join("")}

          </ul>


          <strong>
            Ustoz topgan muammolar
          </strong>

          <ul>

            ${(data.weaknesses || [])
              .map(
                item =>
                  `<li>
                    ${escapeHTML(
                      item
                    )}
                  </li>`
              )
              .join("")}

          </ul>


          <strong>
            Keyingi mashq
          </strong>

          <ul>

            ${(data.next_steps || [])
              .map(
                item =>
                  `<li>
                    ${escapeHTML(
                      item
                    )}
                  </li>`
              )
              .join("")}

          </ul>


          ${
            data.corrected_answer

              ? `

                <div class="transcript">

                  <strong>
                    Yaxshiroq variant:
                  </strong>

                  <br>

                  ${escapeHTML(
                    data.corrected_answer
                  )}

                </div>

              `

              : ""

          }

        `;

    }


    if (
      $("#statSpeaking")
    ) {

      $("#statSpeaking")
        .textContent =
        band.toFixed(1);

    }


    speak(
      data.message ||
      ""
    );

  } catch (error) {

    toast(
      error.message
    );

  } finally {

    button.disabled =
      false;

    button.textContent =
      "Javobni tekshirish";

  }

}


/* =====================================================
   LISTENING
===================================================== */

$("#listenPlay")
  ?.addEventListener(
    "click",

    () => {

      speak(
        `
        The student usually arrives
        at the university at eight thirty.
        On busy days, she leaves home
        earlier to avoid traffic.
        `
      );

    }
  );


$("#checkListen")
  ?.addEventListener(
    "click",

    () => {

      const answer =
        document.querySelector(
          'input[name="lq"]:checked'
        );


      if (!answer) {

        toast(
          "Avval javobni tanlang."
        );

        return;

      }


      if (
        answer.value ===
        "8:30"
      ) {

        if (
          $("#listenFeedback")
        ) {

          $("#listenFeedback")
            .innerHTML = `

              <strong
                style="color:#c8ff42"
              >
                To‘g‘ri.
              </strong>

              Ustoz hozircha
              seni hurmat qilyapti. 😌

            `;

        }


        if (
          $("#statListening")
        ) {

          $("#statListening")
            .textContent =
            "7.0";

        }

      } else {

        if (
          $("#listenFeedback")
        ) {

          $("#listenFeedback")
            .innerHTML = `

              <strong
                style="color:#ff7184"
              >
                Noto‘g‘ri.
              </strong>

              Audio yana bir marta.
              Shoshma.

            `;

        }

      }

    }
  );


/* =====================================================
   READING
===================================================== */

$("#checkReading")
  ?.addEventListener(
    "click",

    () => {

      const answer =
        document.querySelector(
          'input[name="rq"]:checked'
        );


      if (!answer) {

        toast(
          "Avval javobni tanlang."
        );

        return;

      }


      if (
        answer.value ===
        "b"
      ) {

        if (
          $("#readingFeedback")
        ) {

          $("#readingFeedback")
            .innerHTML = `

              <strong
                style="color:#c8ff42"
              >
                To‘g‘ri.
              </strong>

              Reading tirik qoldi. 😌

            `;

        }


        if (
          $("#statReading")
        ) {

          $("#statReading")
            .textContent =
            "7.0";

        }

      } else {

        if (
          $("#readingFeedback")
        ) {

          $("#readingFeedback")
            .innerHTML = `

              <strong
                style="color:#ff7184"
              >
                Noto‘g‘ri.
              </strong>

              Matnni yana bir marta o‘qi.

            `;

        }

      }

    }
  );


/* =====================================================
   CHAT
===================================================== */

$("#sendChat")
  ?.addEventListener(
    "click",
    sendChat
  );


$("#chatInput")
  ?.addEventListener(
    "keydown",

    event => {

      if (
        event.key ===
        "Enter"
      ) {

        sendChat();

      }

    }
  );


async function sendChat() {

  const input =
    $("#chatInput");


  const message =
    input
      ?.value
      .trim();


  if (!message) {
    return;
  }


  addMessage(
    "user",
    message
  );


  input.value =
    "";


  const pending =
    addMessage(
      "teacher",
      "Ustoz yozmoqda..."
    );


  try {

    const response =
      await fetch(
        "/api/chat",

        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify({

              message,

              history:
                state.history,

              profile: {

                target:
                  state.target,

                deadline:
                  state.deadline,

                level:
                  state.level

              }

            })

        }
      );


    const data =
      await response.json();


    if (
      !response.ok
    ) {

      throw new Error(
        data.error ||
        "AI xatosi"
      );

    }


    pending
      .querySelector(
        "p"
      )
      .textContent =
      data.reply;


    state.history.push(

      {
        role:
          "user",

        content:
          message
      },

      {
        role:
          "assistant",

        content:
          data.reply
      }

    );


    speak(
      data.reply
    );

  } catch (error) {

    pending
      .querySelector(
        "p"
      )
      .textContent =
      error.message;

  }

}


function addMessage(
  role,
  text
) {

  const message =
    document.createElement(
      "div"
    );


  message.className =
    `message ${role}`;


  message.innerHTML = `

    <b>

      ${
        role ===
        "teacher"

          ? "Ustoz AI"

          : "Siz"

      }

    </b>

    <p>

      ${escapeHTML(
        text
      )}

    </p>

  `;


  $("#chatbox")
    ?.appendChild(
      message
    );


  if (
    $("#chatbox")
  ) {

    $("#chatbox")
      .scrollTop =
      $("#chatbox")
        .scrollHeight;

  }


  return message;

}


/* =====================================================
   NORMAL TTS
===================================================== */

async function speak(
  text
) {

  if (!text) {
    return;
  }


  try {

    const response =
      await fetch(
        "/api/tts",

        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify({
              text
            })

        }
      );


    if (
      !response.ok
    ) {

      return;

    }


    const blob =
      await response.blob();


    const url =
      URL.createObjectURL(
        blob
      );


    const audio =
      new Audio(
        url
      );


    audio
      .play()
      .catch(
        () => {}
      );


    audio.onended =
      () => {

        URL.revokeObjectURL(
          url
        );

      };

  } catch {}

}


/* =====================================================
   START
===================================================== */

ensureLiveUI();


if (
  location.hash ===
  "#speaking"
) {

  openTab(
    "speaking"
  );

}
