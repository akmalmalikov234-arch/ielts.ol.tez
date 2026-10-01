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

  diagnosticAnswers: []

};


/* =========================
   TOAST
========================= */

function toast(message) {

  const element =
    $("#toast");

  element.textContent =
    message;

  element.classList.add("show");

  setTimeout(() => {

    element.classList.remove("show");

  }, 2800);
}


/* =========================
   TABS
========================= */

function openTab(name) {

  $$(".tab").forEach(tab => {

    tab.classList.remove("active");

  });

  const selected =
    $("#" + name);

  if (selected) {

    selected.classList.add("active");

  }


  $$(".nav-button").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.tab === name
    );

  });

}


$$(".nav-button").forEach(button => {

  button.addEventListener(
    "click",
    () => openTab(button.dataset.tab)
  );

});


/* =========================
   HERO BUTTONS
========================= */

$("#startBtn")
  .addEventListener(
    "click",
    () => {

      document
        .getElementById("diagnosticStart")
        .scrollIntoView({
          behavior: "smooth",
          block: "center"
        });

    }
  );


$("#demoBtn")
  .addEventListener(
    "click",
    () => {

      openTab("chat");

      $("#chatInput").value =
        "Ustoz, IELTS 8.0 olish uchun qayerdan boshlayman?";

      sendChat();

    }
  );


/* =========================
   TARGET
========================= */

$$(".target-buttons button")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        $$(".target-buttons button")
          .forEach(item =>
            item.classList.remove("selected")
          );

        button.classList.add("selected");

        state.target =
          button.dataset.target;

        $("#targetBand").textContent =
          state.target;

      }
    );

  });


/* =========================
   DIAGNOSTIC
========================= */

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
  .addEventListener(
    "click",
    startDiagnostic
  );


function startDiagnostic() {

  if (!state.target) {

    toast(
      "Avval maqsad balingizni tanlang 😌"
    );

    return;
  }


  state.deadline =
    $("#deadline").value.trim() ||
    "aniq emas";


  diagnosticIndex = 0;

  state.diagnosticAnswers = [];


  $("#diagnosticModal")
    .classList.remove("hidden");


  renderDiagnostic();

}


function renderDiagnostic() {

  const container =
    $("#diagStep");


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
      ${escapeHTML(question.question)}
    </div>

    <div class="diag-options">

      ${question.options
        .map(
          (option, index) => `

          <button
            data-index="${index}"
          >
            ${escapeHTML(option)}
          </button>

        `
        )
        .join("")}

    </div>

  `;


  $$(".diag-options button")
    .forEach(button => {

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
                question.options[index]

            });


          diagnosticIndex++;

          renderDiagnostic();

        }
      );

    });

}


$("#closeModal")
  .addEventListener(
    "click",
    () => {

      $("#diagnosticModal")
        .classList.add("hidden");

    }
  );


async function submitDiagnostic() {

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


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Diagnostika xatosi"
      );

    }


    $("#diagnosticModal")
      .classList.add("hidden");


    const band =
      Number(data.band || 0);


    $("#statBand")
      .textContent =
      band.toFixed(1);


    $("#targetBand")
      .textContent =
      state.target;


    const target =
      Number(state.target);


    const percentage =
      Math.min(
        100,
        Math.max(
          5,
          (band / target) * 100
        )
      );


    $("#progressBar")
      .style.width =
      percentage + "%";


    $("#progressText")
      .textContent =
      data.message;


    $("#sideLevel")
      .textContent =
      `Taxminiy: ${band.toFixed(1)}`;


    toast(
      "Diagnostika tugadi. Endi ustoz qochirmaydi 😌"
    );


  } catch (error) {

    toast(error.message);

    $("#diagnosticModal")
      .classList.add("hidden");

  }

}


/* =========================
   SPEAKING RECORDER
========================= */

let timerInterval = null;

let startedAt = null;


$("#recordBtn")
  .addEventListener(
    "click",
    async () => {

      if (state.recording) {

        stopRecording();

        return;
      }


      await startRecording();

    }
  );


async function startRecording() {

  try {

    const stream =
      await navigator
        .mediaDevices
        .getUserMedia({
          audio: true
        });


    state.chunks = [];


    let mimeType =
      "audio/webm";


    if (
      !MediaRecorder
        .isTypeSupported(
          "audio/webm"
        )
    ) {

      mimeType =
        "audio/mp4";

    }


    state.recorder =
      new MediaRecorder(
        stream,
        {
          mimeType
        }
      );


    state.recorder
      .ondataavailable =
      event => {

        if (
          event.data &&
          event.data.size
        ) {

          state.chunks.push(
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


    state.recording = true;

    startedAt =
      Date.now();


    timerInterval =
      setInterval(
        updateTimer,
        200
      );


    $(".recorder")
      .classList.add(
        "recording"
      );


    $("#recordState")
      .textContent =
      "Yozilmoqda";


    $("#recordHint")
      .textContent =
      "Tugatish uchun mikrofonni bosing";


  } catch (error) {

    toast(
      "Mikrofonga ruxsat berilmadi."
    );

  }

}


function stopRecording() {

  state.recording = false;


  clearInterval(
    timerInterval
  );


  if (state.recorder) {

    state.recorder.stop();

  }


  $(".recorder")
    .classList.remove(
      "recording"
    );


  $("#recordState")
    .textContent =
    "Tahlil qilinmoqda";


  $("#recordHint")
    .textContent =
    "Audio matnga aylantirilmoqda...";

}


function updateTimer() {

  const seconds =
    Math.floor(
      (Date.now() - startedAt) /
      1000
    );


  const minutes =
    Math.floor(
      seconds / 60
    );


  const rest =
    seconds % 60;


  $("#timer")
    .textContent =

    String(minutes)
      .padStart(2, "0")

    + ":" +

    String(rest)
      .padStart(2, "0");

}


/* =========================
   TRANSCRIPTION
========================= */

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
          method: "POST",
          body: form
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Transkripsiya xatosi"
      );

    }


    state.transcript =
      data.text || "";


    $("#transcript")
      .textContent =
      state.transcript ||
      "Ovoz aniqlanmadi.";


    $("#gradeBtn")
      .disabled =
      !state.transcript;


    $("#recordState")
      .textContent =
      "Tayyor";


    $("#recordHint")
      .textContent =
      "Javobingizni tekshirish mumkin";


  } catch (error) {

    toast(error.message);

    $("#recordState")
      .textContent =
      "Xatolik";

  }

}


/* =========================
   SPEAKING GRADE
========================= */

$("#gradeBtn")
  .addEventListener(
    "click",
    gradeSpeaking
  );


async function gradeSpeaking() {

  const button =
    $("#gradeBtn");


  button.disabled = true;

  button.textContent =
    "Ustoz tekshiryapti...";


  try {

    const response =
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


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Baholash xatosi"
      );

    }


    const band =
      Number(data.band || 0);


    $("#speakingResult")
      .classList.remove(
        "hidden"
      );


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
          data.message
        )}
      </h3>

      <strong>
        Kuchli tomonlar
      </strong>

      <ul>

        ${data.strengths
          .map(
            item =>
              `<li>
                ${escapeHTML(item)}
              </li>`
          )
          .join("")}

      </ul>


      <strong>
        Ustoz topgan muammolar
      </strong>

      <ul>

        ${data.weaknesses
          .map(
            item =>
              `<li>
                ${escapeHTML(item)}
              </li>`
          )
          .join("")}

      </ul>


      <strong>
        Keyingi mashq
      </strong>

      <ul>

        ${data.next_steps
          .map(
            item =>
              `<li>
                ${escapeHTML(item)}
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


    $("#statSpeaking")
      .textContent =
      band.toFixed(1);


    speak(
      data.message
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


/* =========================
   LISTENING
========================= */

$("#listenPlay")
  .addEventListener(
    "click",
    () => {

      const text =
        `
        The student usually arrives
        at the university at eight thirty.
        On busy days, she leaves home
        earlier to avoid traffic.
        `;

      speak(text);

    }
  );


$("#checkListen")
  .addEventListener(
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

        $("#listenFeedback")
          .innerHTML = `

            <strong
              style="color:#c8ff42"
            >
              To'g'ri.
            </strong>

            Ustoz hozircha seni
            hurmat qilyapti. 😌

          `;


        $("#statListening")
          .textContent =
          "7.0";

      } else {

        $("#listenFeedback")
          .innerHTML = `

            <strong
              style="color:#ff7184"
            >
              Noto'g'ri.
            </strong>

            Audio yana bir marta.
            Shoshma.

          `;

      }

    }
  );


/* =========================
   READING
========================= */

$("#checkReading")
  .addEventListener(
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
        answer.value === "b"
      ) {

        $("#readingFeedback")
          .innerHTML = `

            <strong
              style="color:#c8ff42"
            >
              To'g'ri.
            </strong>

            Reading tirik qoldi. 😌

          `;


        $("#statReading")
          .textContent =
          "7.0";

      } else {

        $("#readingFeedback")
          .innerHTML = `

            <strong
              style="color:#ff7184"
            >
              Noto'g'ri.
            </strong>

            Matnni yana bir marta o'qi.

          `;

      }

    }
  );


/* =========================
   CHAT
========================= */

$("#sendChat")
  .addEventListener(
    "click",
    sendChat
  );


$("#chatInput")
  .addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter"
      ) {

        sendChat();

      }

    }
  );


async function sendChat() {

  const input =
    $("#chatInput");


  const message =
    input.value.trim();


  if (!message) {

    return;

  }


  addMessage(
    "user",
    message
  );


  input.value = "";


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

          method: "POST",

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


    if (!response.ok) {

      throw new Error(
        data.error ||
        "AI xatosi"
      );

    }


    pending
      .querySelector("p")
      .textContent =
      data.reply;


    state.history.push(
      {
        role: "user",
        content: message
      },

      {
        role: "assistant",
        content: data.reply
      }
    );


    speak(
      data.reply
    );


  } catch (error) {

    pending
      .querySelector("p")
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
        role === "teacher"
          ? "Ustoz AI"
          : "Siz"
      }
    </b>

    <p>
      ${escapeHTML(text)}
    </p>

  `;


  $("#chatbox")
    .appendChild(message);


  $("#chatbox")
    .scrollTop =
    $("#chatbox").scrollHeight;


  return message;

}


/* =========================
   TTS
========================= */

async function speak(text) {

  try {

    const response =
      await fetch(
        "/api/tts",
        {

          method: "POST",

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


    if (!response.ok) {

      return;

    }


    const blob =
      await response.blob();


    const url =
      URL.createObjectURL(
        blob
      );


    const audio =
      new Audio(url);


    audio.play();


    audio.onended =
      () => {

        URL.revokeObjectURL(
          url
        );

      };


  } catch {

    // Audio ishlamasa,
    // matnli javob baribir chiqadi.

  }

}


/* =========================
   SECURITY
========================= */

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

        return map[character];

      }
    );

}
