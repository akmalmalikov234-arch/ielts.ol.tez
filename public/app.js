const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  [...document.querySelectorAll(selector)];


const state = {

  live: {
    ws: null,
    stream: null,
    audioContext: null,
    processor: null,
    source: null,
    running: false,
    nextPlayTime: 0,
    nodes: new Set()
  },

  recorder: {
    media: null,
    chunks: [],
    startedAt: 0,
    timer: null,
    blob: null
  },

  chatHistory: [],

  diagnosticAnswers: [],

  level: "A2-B1",

  speakingQuestion:
    "What do you usually do in your free time?"
};


/* ========================================
   HTML ESCAPE
======================================== */

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        "\"": "&quot;"
      })[c]
  );
}


/* ========================================
   TABS
======================================== */

function openTab(id) {

  $$(".tab").forEach(
    (button) => {
      button.classList.toggle(
        "active",
        button.dataset.tab === id
      );
    }
  );

  $$(".tab-panel").forEach(
    (panel) => {
      panel.classList.toggle(
        "active",
        panel.id === id
      );
    }
  );

  history.replaceState(
    null,
    "",
    `#${id}`
  );
}


$$(".tab").forEach(
  (button) => {
    button.addEventListener(
      "click",
      () =>
        openTab(
          button.dataset.tab
        )
    );
  }
);


$$("[data-open]").forEach(
  (button) => {
    button.addEventListener(
      "click",
      () =>
        openTab(
          button.dataset.open
        )
    );
  }
);


/* ========================================
   SERVER CHECK
======================================== */

async function checkServer() {

  try {

    const response =
      await fetch(
        "/api/health"
      );

    const data =
      await response.json();

    const el =
      $("#serverStatus");

    if (
      data.ok &&
      data.geminiConfigured
    ) {

      el.innerHTML =
        '<span class="status-dot" style="background:#c8ff42"></span> AI tayyor';

    } else {

      el.innerHTML =
        '<span class="status-dot" style="background:#ff4e69"></span> GEMINI_API_KEY kerak';

    }

  } catch {

    $("#serverStatus").textContent =
      "Server ulanmagan";

  }
}


/* ========================================
   DIAGNOSTIC
======================================== */

function renderDiagnostic() {

  const questions = [

    {
      q:
        "Choose the correct sentence.",

      a: [
        "She go to school every day.",
        "She goes to school every day.",
        "She going to school every day."
      ],

      correct: 1
    },

    {
      q:
        "What is the closest meaning of 'rapid'?",

      a: [
        "slow",
        "quick",
        "heavy"
      ],

      correct: 1
    },

    {
      q:
        "Complete: If I had more time, I ___ more English.",

      a: [
        "would study",
        "will studied",
        "study"
      ],

      correct: 0
    },

    {
      q:
        "Which is natural in IELTS Speaking?",

      a: [
        "In my opinion, ...",
        "In my opinion is ...",
        "I opinion ..."
      ],

      correct: 0
    },

    {
      q:
        "Choose the best response: 'How often do you read?'",

      a: [
        "I read twice a week.",
        "Yes, I am.",
        "At the library is."
      ],

      correct: 0
    }

  ];


  $("#diagnosticBox").innerHTML =
    questions
      .map(
        (item, i) => `
          <div class="quiz-q">

            <h3>
              ${i + 1}.
              ${escapeHtml(item.q)}
            </h3>

            <div class="quiz-options">

              ${item.a
                .map(
                  (x, j) => `
                    <button
                      class="option"
                      data-q="${i}"
                      data-a="${j}"
                    >
                      ${escapeHtml(x)}
                    </button>
                  `
                )
                .join("")}

            </div>

          </div>
        `
      )
      .join("") +

    `
      <button
        class="btn primary"
        id="diagnosticSubmit"
      >
        Natijani ko‘rish
      </button>

      <div
        id="diagnosticResult"
      ></div>
    `;


  $$("#diagnosticBox .option")
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const q =
              Number(
                button.dataset.q
              );

            const a =
              Number(
                button.dataset.a
              );

            $$(
              `.option[data-q="${q}"]`
            ).forEach(
              (b) =>
                b.classList.remove(
                  "selected"
                )
            );

            button.classList.add(
              "selected"
            );

            state
              .diagnosticAnswers[q] =
              a;
          }
        );

      }
    );


  $("#diagnosticSubmit")
    .addEventListener(
      "click",
      submitDiagnostic
    );
}


async function submitDiagnostic() {

  const answers =
    state.diagnosticAnswers;


  if (
    answers.length !== 5 ||
    answers.some(
      (x) =>
        typeof x !==
        "number"
    )
  ) {

    $("#diagnosticResult")
      .innerHTML =
      `
        <div class="result">
          Avval 5 ta savolning
          hammasiga javob ber.
        </div>
      `;

    return;
  }


  const correctAnswers =
    [1, 1, 0, 0, 0];


  const localScore =
    answers.reduce(
      (sum, answer, index) =>
        sum +
        (
          correctAnswers[index] ===
          answer
            ? 1
            : 0
        ),
      0
    );


  $("#diagnosticResult")
    .innerHTML =
    `
      <div class="result">
        AI tahlil qilmoqda...
      </div>
    `;


  try {

    const response =
      await fetch(
        "/api/diagnostic",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              answers
            })
        }
      );


    const data =
      await response.json();


    if (!response.ok) {
      throw new Error(
        data.error ||
        "Xato"
      );
    }


    const result =
      data.result;


    state.level =
      result.estimatedLevel ||
      (
        localScore >= 4
          ? "B1-B2"
          : "A2-B1"
      );


    $("#diagnosticResult")
      .innerHTML =
      `
        <div class="result">

          <b>
            Taxminiy daraja:
          </b>

          ${escapeHtml(
            state.level
          )}

          <br>

          <b>
            AI bahosi:
          </b>

          ${escapeHtml(
            result.overall
          )}
          / 9

          <p>
            ${escapeHtml(
              result.message ||
              ""
            )}
          </p>

          <b>
            Reja:
          </b>

          <ul>
            ${
              (
                result.plan ||
                []
              )
                .map(
                  escapeHtml
                )
                .map(
                  (v) =>
                    `<li>${v}</li>`
                )
                .join("")
            }
          </ul>

        </div>
      `;

  } catch (error) {

    $("#diagnosticResult")
      .innerHTML =
      `
        <div class="result">

          AI ishlamadi:
          ${escapeHtml(
            error.message
          )}

          <br>

          Mahalliy test:
          ${localScore}/5.

        </div>
      `;

  }
}


/* ========================================
   AUDIO HELPERS
======================================== */

function base64FromBytes(
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

  return btoa(
    binary
  );
}


function bytesFromBase64(
  base64
) {

  const binary =
    atob(base64);

  const output =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {

    output[i] =
      binary.charCodeAt(i);
  }

  return output;
}


function floatToPcm16(
  input
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

    const sample =
      Math.max(
        -1,
        Math.min(
          1,
          input[i]
        )
      );

    output[i] =
      sample < 0
        ? sample * 0x8000
        : sample * 0x7fff;
  }

  return new Uint8Array(
    output.buffer
  );
}


function downsample(
  buffer,
  inputRate,
  outputRate = 16000
) {

  if (
    inputRate ===
    outputRate
  ) {
    return buffer;
  }


  const ratio =
    inputRate /
    outputRate;


  const length =
    Math.round(
      buffer.length /
      ratio
    );


  const result =
    new Float32Array(
      length
    );


  let offset = 0;


  for (
    let i = 0;
    i < length;
    i++
  ) {

    const next =
      Math.min(
        buffer.length,
        Math.round(
          (i + 1) *
          ratio
        )
      );


    let sum = 0;
    let count = 0;


    for (
      let j = offset;
      j < next;
      j++
    ) {

      sum +=
        buffer[j];

      count++;
    }


    result[i] =
      count
        ? sum / count
        : 0;


    offset = next;
  }


  return result;
}


/* ========================================
   LIVE UI
======================================== */

function addLiveBubble(
  role,
  text
) {

  if (
    !text ||
    !text.trim()
  ) {
    return;
  }


  const div =
    document.createElement(
      "div"
    );


  div.className =
    `bubble ${role}`;


  div.textContent =
    text.trim();


  $("#liveConversation")
    .appendChild(
      div
    );


  $("#liveConversation")
    .scrollTop =
    $("#liveConversation")
      .scrollHeight;
}


function setLiveUi(
  running,
  status = ""
) {

  state.live.running =
    running;


  $("#liveStart")
    .disabled =
    running;


  $("#liveStop")
    .disabled =
    !running;


  $("#liveState")
    .textContent =
    running
      ? "LIVE"
      : "OFFLINE";


  $("#liveState")
    .classList
    .toggle(
      "lime",
      running
    );


  $("#wave")
    .classList
    .toggle(
      "live",
      running
    );


  if (status) {

    $("#liveStatus")
      .textContent =
      status;
  }
}


function stopScheduledAudio() {

  state.live.nodes
    .forEach(
      (node) => {

        try {
          node.stop();
        } catch {}

      }
    );


  state.live.nodes.clear();


  if (
    state.live.audioContext
  ) {

    state.live.nextPlayTime =
      state.live.audioContext
        .currentTime;
  }
}


/* ========================================
   PLAY GEMINI PCM AUDIO
======================================== */

function playPcm24k(
  base64
) {

  const ctx =
    state.live.audioContext;


  if (!ctx) {
    return;
  }


  const bytes =
    bytesFromBase64(
      base64
    );


  const samples =
    new Int16Array(
      bytes.buffer,
      bytes.byteOffset,
      Math.floor(
        bytes.byteLength /
        2
      )
    );


  const audio =
    ctx.createBuffer(
      1,
      samples.length,
      24000
    );


  const channel =
    audio.getChannelData(
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
    ctx.createBufferSource();


  source.buffer =
    audio;


  source.connect(
    ctx.destination
  );


  const now =
    ctx.currentTime;


  const start =
    Math.max(
      now + 0.01,
      state.live.nextPlayTime
    );


  source.start(
    start
  );


  state.live.nextPlayTime =
    start +
    audio.duration;


  state.live.nodes.add(
    source
  );


  source.onended =
    () =>
      state.live.nodes.delete(
        source
      );
}


/* ========================================
   START LIVE
======================================== */

async function startLive() {

  if (
    state.live.running
  ) {
    return;
  }


  setLiveUi(
    false,
    "Ulanish tayyorlanmoqda..."
  );


  try {

    const tokenResponse =
      await fetch(
        "/api/live-token",
        {
          method: "POST"
        }
      );


    const tokenData =
      await tokenResponse.json();


    if (
      !tokenResponse.ok
    ) {

      throw new Error(
        tokenData.error ||
        "Live token xatosi"
      );
    }


    const token =
      tokenData.token;


    const model =
      tokenData.model ||
      "gemini-3.8-live";


    const websocketUrl =
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(
        token
      )}`;


    const ws =
      new WebSocket(
        websocketUrl
      );


    state.live.ws =
      ws;


    ws.onopen =
      async () => {

        const systemInstruction = `
You are a calm, friendly IELTS Speaking teacher.

Speak naturally in English.

Start with a short greeting
and one simple IELTS-style question.

Ask one question at a time.

Let the learner finish speaking.

Do not interrupt too much.

After the learner answers,
give one or two short corrections
when useful, then continue.

Adapt difficulty to:
${state.level}

If the learner uses Uzbek,
you can briefly clarify in Uzbek,
then continue in English.

Never claim to be an official
IELTS examiner.

Keep the conversation natural,
calm and encouraging.
        `.trim();


        const setupMessage = {
          setup: {

            model:
              `models/${model}`,

            generationConfig: {
              responseModalities:
                ["AUDIO"]
            },

            inputAudioTranscription: {},

            outputAudioTranscription: {},

            systemInstruction: {
              parts: [
                {
                  text:
                    systemInstruction
                }
              ]
            }
          }
        };


        ws.send(
          JSON.stringify(
            setupMessage
          )
        );


        try {

          await startMicrophone();

          setLiveUi(
            true,
            "Ustoz tinglayapti... Gapiring."
          );

        } catch (error) {

          try {
            ws.close();
          } catch {}

          throw error;
        }
      };


    ws.onmessage =
      (event) => {

        let data;

        try {

          data =
            JSON.parse(
              event.data
            );

        } catch {

          return;
        }


        const content =
          data.serverContent;


        if (!content) {
          return;
        }


        if (
          content.interrupted
        ) {

          stopScheduledAudio();
        }


        if (
          content.inputTranscription &&
          content.inputTranscription.text
        ) {

          addLiveBubble(
            "user",
            content
              .inputTranscription
              .text
          );
        }


        if (
          content.outputTranscription &&
          content.outputTranscription.text
        ) {

          addLiveBubble(
            "ai",
            content
              .outputTranscription
              .text
          );
        }


        if (
          content.modelTurn &&
          Array.isArray(
            content.modelTurn.parts
          )
        ) {

          content.modelTurn.parts
            .forEach(
              (part) => {

                if (
                  part.inlineData &&
                  part.inlineData.data
                ) {

                  playPcm24k(
                    part.inlineData.data
                  );
                }

              }
            );
        }


        if (
          content.turnComplete
        ) {

          $("#liveStatus")
            .textContent =
            "Ustoz javob berdi. Endi siz gapiring.";
        }
      };


    ws.onerror =
      () => {

        $("#liveStatus")
          .textContent =
          "Live ulanishida xato yuz berdi.";

      };


    ws.onclose =
      () => {

        stopMicrophone();

        setLiveUi(
          false,
          "Suhbat tugadi."
        );

        state.live.ws =
          null;
      };

  } catch (error) {

    await stopLive();

    setLiveUi(
      false,
      `Xato: ${error.message}`
    );
  }
}


/* ========================================
   MICROPHONE
======================================== */

async function startMicrophone() {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    throw new Error(
      "Brauzer mikrofonni qo‘llab-quvvatlamaydi."
    );
  }


  const stream =
    await navigator.mediaDevices
      .getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });


  const AudioContextClass =
    window.AudioContext ||
    window.webkitAudioContext;


  if (!AudioContextClass) {

    stream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );

    throw new Error(
      "AudioContext brauzerda mavjud emas."
    );
  }


  const ctx =
    new AudioContextClass();


  await ctx.resume();


  const source =
    ctx.createMediaStreamSource(
      stream
    );


  const processor =
    ctx.createScriptProcessor(
      4096,
      1,
      1
    );


  processor.onaudioprocess =
    (event) => {

      const ws =
        state.live.ws;


      if (
        !ws ||
        ws.readyState !==
          WebSocket.OPEN
      ) {

        return;
      }


      const data =
        downsample(
          event
            .inputBuffer
            .getChannelData(0),

          ctx.sampleRate,

          16000
        );


      const pcm =
        floatToPcm16(
          data
        );


      ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              data:
                base64FromBytes(
                  pcm
                ),

              mimeType:
                "audio/pcm;rate=16000"
            }
          }
        })
      );
    };


  const silent =
    ctx.createGain();


  silent.gain.value = 0;


  source.connect(
    processor
  );


  processor.connect(
    silent
  );


  silent.connect(
    ctx.destination
  );


  state.live.stream =
    stream;

  state.live.audioContext =
    ctx;

  state.live.source =
    source;

  state.live.processor =
    processor;

  state.live.nextPlayTime =
    ctx.currentTime;
}


/* ========================================
   STOP MICROPHONE
======================================== */

function stopMicrophone() {

  if (
    state.live.processor
  ) {

    try {
      state.live.processor.disconnect();
    } catch {}

  }


  if (
    state.live.source
  ) {

    try {
      state.live.source.disconnect();
    } catch {}

  }


  if (
    state.live.stream
  ) {

    state.live.stream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );
  }


  if (
    state.live.audioContext
  ) {

    try {
      state.live.audioContext.close();
    } catch {}
  }


  state.live.processor =
    null;

  state.live.source =
    null;

  state.live.stream =
    null;

  state.live.audioContext =
    null;
}


/* ========================================
   STOP LIVE
======================================== */

async function stopLive() {

  stopScheduledAudio();

  stopMicrophone();


  if (
    state.live.ws
  ) {

    try {

      state.live.ws.close(
        1000,
        "user stop"
      );

    } catch {}

    state.live.ws =
      null;
  }


  setLiveUi(
    false,
    "Suhbat to‘xtatildi."
  );
}


$("#liveStart")
  .addEventListener(
    "click",
    startLive
  );


$("#liveStop")
  .addEventListener(
    "click",
    stopLive
  );


/* ========================================
   NORMAL SPEAKING RECORDER
======================================== */

async function startRecorder() {

  const stream =
    await navigator.mediaDevices
      .getUserMedia({
        audio: true
      });


  const mime =
    MediaRecorder
      .isTypeSupported(
        "audio/webm;codecs=opus"
      )
      ? "audio/webm;codecs=opus"
      : "audio/webm";


  const media =
    new MediaRecorder(
      stream,
      {
        mimeType: mime
      }
    );


  state.recorder.media =
    media;

  state.recorder.chunks =
    [];

  state.recorder.startedAt =
    Date.now();


  media.ondataavailable =
    (event) => {

      if (
        event.data.size
      ) {

        state.recorder.chunks.push(
          event.data
        );
      }
    };


  media.onstop =
    () => {

      stream
        .getTracks()
        .forEach(
          (track) =>
            track.stop()
        );


      state.recorder.blob =
        new Blob(
          state.recorder.chunks,
          {
            type: mime
          }
        );


      $("#gradeBtn")
        .disabled = false;
    };


  media.start(
    250
  );


  $("#recordBtn")
    .textContent =
    "■ To‘xtatish";


  state.recorder.timer =
    setInterval(
      () => {

        const seconds =
          Math.floor(
            (
              Date.now() -
              state.recorder
                .startedAt
            ) / 1000
          );


        $("#recordTimer")
          .textContent =
          `${String(
            Math.floor(
              seconds / 60
            )
          ).padStart(
            2,
            "0"
          )}:${String(
            seconds % 60
          ).padStart(
            2,
            "0"
          )}`;

      },
      250
    );
}


function stopRecorder() {

  if (
    !state.recorder.media
  ) {

    return;
  }


  state.recorder.media.stop();

  state.recorder.media =
    null;


  clearInterval(
    state.recorder.timer
  );


  $("#recordBtn")
    .textContent =
    "● Yozishni boshlash";
}


$("#recordBtn")
  .addEventListener(
    "click",
    () => {

      if (
        state.recorder.media
      ) {

        stopRecorder();

      } else {

        startRecorder()
          .catch(
            (error) =>
              alert(
                error.message
              )
          );
      }

    }
  );


/* ========================================
   SPEAKING GRADE
======================================== */

$("#gradeBtn")
  .addEventListener(
    "click",
    async () => {

      if (
        !state.recorder.blob
      ) {

        return;
      }


      $("#gradeResult")
        .innerHTML =
        `
          <div class="grade">
            Audio transkripsiya
            qilinmoqda...
          </div>
        `;


      const formData =
        new FormData();


      formData.append(
        "audio",
        state.recorder.blob,
        "speaking.webm"
      );


      try {

        const transcriptionResponse =
          await fetch(
            "/api/transcribe",
            {
              method: "POST",
              body: formData
            }
          );


        const transcriptionData =
          await transcriptionResponse
            .json();


        if (
          !transcriptionResponse.ok
        ) {

          throw new Error(
            transcriptionData.error
          );
        }


        $("#transcript")
          .textContent =
          transcriptionData
            .transcript;


        $("#gradeResult")
          .innerHTML =
          `
            <div class="grade">
              AI baholayapti...
            </div>
          `;


        const gradeResponse =
          await fetch(
            "/api/speaking/grade",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({
                  transcript:
                    transcriptionData
                      .transcript,

                  question:
                    state.speakingQuestion,

                  level:
                    state.level
                })
            }
          );


        const gradeData =
          await gradeResponse
            .json();


        if (
          !gradeResponse.ok
        ) {

          throw new Error(
            gradeData.error
          );
        }


        const result =
          gradeData.result;


        const corrections =
          (
            result.corrections ||
            []
          )
            .map(
              (item) => `
                <li>
                  ${escapeHtml(
                    item.original
                  )}
                  →
                  <b>
                    ${escapeHtml(
                      item.better
                    )}
                  </b>
                  —
                  ${escapeHtml(
                    item.reason
                  )}
                </li>
              `
            )
            .join("");


        const strengths =
          (
            result.strengths ||
            []
          )
            .map(
              escapeHtml
            )
            .join(", ");


        $("#gradeResult")
          .innerHTML =
          `
            <div class="grade">

              <div class="grade-score">
                ${escapeHtml(
                  result.band
                )}
                / 9
              </div>

              <b>
                Fluency:
              </b>

              ${escapeHtml(
                result.fluency
              )}

              &nbsp;

              <b>
                Lexical:
              </b>

              ${escapeHtml(
                result.lexical
              )}

              &nbsp;

              <b>
                Grammar:
              </b>

              ${escapeHtml(
                result.grammar
              )}

              <p>
                <b>
                  Kuchli tomonlar:
                </b>

                ${strengths}
              </p>

              <b>
                Tuzatishlar:
              </b>

              <ul>
                ${corrections}
              </ul>

            </div>
          `;

      } catch (error) {

        $("#gradeResult")
          .innerHTML =
          `
            <div class="grade">

              Xato:
              ${escapeHtml(
                error.message
              )}

            </div>
          `;

      }
    }
  );


/* ========================================
   LISTENING
======================================== */

function initListening() {

  const questions = [

    [
      "What is the topic?",
      [
        "Study routines",
        "Cooking",
        "Travel"
      ],
      0
    ],

    [
      "What helps build a habit?",
      [
        "Long sessions only",
        "Short repeated sessions",
        "No practice"
      ],
      1
    ]

  ];


  $("#listeningQuiz")
    .innerHTML =
    questions
      .map(
        (question, index) => `

          <div class="quiz-q">

            <h3>
              ${index + 1}.
              ${escapeHtml(
                question[0]
              )}
            </h3>

            <div class="quiz-options">

              ${question[1]
                .map(
                  (option, optionIndex) => `
                    <button
                      class="option"
                      data-lq="${index}"
                      data-la="${optionIndex}"
                    >
                      ${escapeHtml(
                        option
                      )}
                    </button>
                  `
                )
                .join("")}

            </div>

          </div>

        `
      )
      .join("");


  $$("#listeningQuiz .option")
    .forEach(
      (button) => {

        button.onclick =
          () => {

            const index =
              Number(
                button.dataset.lq
              );

            const answer =
              Number(
                button.dataset.la
              );


            $$(
              `.option[data-lq="${index}"]`
            )
              .forEach(
                (option) =>
                  option.classList
                    .remove(
                      "correct",
                      "wrong"
                    )
              );


            button.classList.add(
              answer ===
              questions[index][2]
                ? "correct"
                : "wrong"
            );
          };
      }
    );
}


/* ========================================
   READING
======================================== */

function initReading() {

  const questions = [

    [
      "Why can short sessions be useful?",

      [
        "They are easier to maintain",
        "They always take hours",
        "They remove vocabulary"
      ],

      0
    ],

    [
      "What should a learner do with new words?",

      [
        "Ignore them",
        "Use them in sentences",
        "Only translate them"
      ],

      1
    ]

  ];


  $("#readingQuiz")
    .innerHTML =
    questions
      .map(
        (question, index) => `

          <div class="quiz-q">

            <h3>
              ${index + 1}.
              ${escapeHtml(
                question[0]
              )}
            </h3>

            <div class="quiz-options">

              ${question[1]
                .map(
                  (option, optionIndex) => `
                    <button
                      class="option"
                      data-rq="${index}"
                      data-ra="${optionIndex}"
                    >
                      ${escapeHtml(
                        option
                      )}
                    </button>
                  `
                )
                .join("")}

            </div>

          </div>

        `
      )
      .join("");


  $$("#readingQuiz .option")
    .forEach(
      (button) => {

        button.onclick =
          () => {

            const index =
              Number(
                button.dataset.rq
              );

            const answer =
              Number(
                button.dataset.ra
              );


            $$(
              `.option[data-rq="${index}"]`
            )
              .forEach(
                (option) =>
                  option.classList
                    .remove(
                      "correct",
                      "wrong"
                    )
              );


            button.classList.add(
              answer ===
              questions[index][2]
                ? "correct"
                : "wrong"
            );
          };
      }
    );
}


/* ========================================
   LISTENING AUDIO
======================================== */

$("#listenPlay")
  .addEventListener(
    "click",
    () => {

      const utterance =
        new SpeechSynthesisUtterance(
          "Good morning. Today we are talking about study routines. A short daily session can be easier to maintain."
        );


      utterance.lang =
        "en-US";


      utterance.rate =
        0.9;


      speechSynthesis.cancel();

      speechSynthesis.speak(
        utterance
      );
    }
  );


/* ========================================
   CHAT
======================================== */

$("#chatForm")
  .addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const input =
        $("#chatInput");


      const text =
        input.value.trim();


      if (!text) {
        return;
      }


      input.value =
        "";


      const windowElement =
        $("#chatWindow");


      windowElement
        .insertAdjacentHTML(
          "beforeend",

          `
            <div class="msg user">
              ${escapeHtml(
                text
              )}
            </div>
          `
        );


      windowElement.scrollTop =
        windowElement.scrollHeight;


      try {

        const response =
          await fetch(
            "/api/chat",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({
                  message:
                    text,

                  history:
                    state.chatHistory
                })
            }
          );


        const data =
          await response.json();


        if (!response.ok) {

          throw new Error(
            data.error ||
            "AI xatosi"
          );
        }


        state.chatHistory.push(
          {
            role: "user",
            text
          },

          {
            role: "model",
            text:
              data.reply
          }
        );


        windowElement
          .insertAdjacentHTML(
            "beforeend",

            `
              <div class="msg ai">
                ${escapeHtml(
                  data.reply
                )}
              </div>
            `
          );


        windowElement.scrollTop =
          windowElement.scrollHeight;

      } catch (error) {

        windowElement
          .insertAdjacentHTML(
            "beforeend",

            `
              <div class="msg ai">
                Xato:
                ${escapeHtml(
                  error.message
                )}
              </div>
            `
          );
      }
    }
  );


/* ========================================
   INITIALIZE
======================================== */

renderDiagnostic();

initListening();

initReading();

checkServer();


const initial =
  location.hash.slice(1);


if (
  initial &&
  $(`#${initial}`)
) {

  openTab(
    initial
  );
}


/* ========================================
   CLEANUP
======================================== */

window.addEventListener(
  "beforeunload",
  () => {

    stopMicrophone();

    if (
      state.live.ws
    ) {

      try {
        state.live.ws.close();
      } catch {}

    }

  }
);
