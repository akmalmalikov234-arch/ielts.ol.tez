import express from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: "/ws/live"
});

const PORT = Number(
  process.env.PORT || 10000
);

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY;

const AI_MODEL =
  process.env.AI_MODEL ||
  "gemini-3.8-flash";

const TRANSCRIBE_MODEL =
  process.env.TRANSCRIBE_MODEL ||
  "gemini-3.8-flash";

const LIVE_MODEL =
  process.env.LIVE_MODEL ||
  "gemini-3.8-live";

const PUBLIC_DIR =
  path.join(
    process.cwd(),
    "public"
  );

const uploadDir =
  path.join(
    process.cwd(),
    ".uploads"
  );

await fs.mkdir(
  uploadDir,
  {
    recursive: true
  }
);

const upload =
  multer({
    dest: uploadDir,

    limits: {
      fileSize:
        15 * 1024 * 1024
    }
  });

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.static(
    PUBLIC_DIR
  )
);


/* =========================
   GEMINI
========================= */

function requireGemini(res) {

  if (!GEMINI_API_KEY) {

    res.status(500).json({
      error:
        "GEMINI_API_KEY Render Environment Variables ichida sozlanmagan."
    });

    return false;
  }

  return true;
}


function teacherPrompt(
  profile = {}
) {

  return `
Sen IELTS USTOZ AI nomli
o'zbekcha IELTS o'qituvchisisan.

Uslubing:

- sokin
- samimiy
- aqlli
- realistik
- motivatsion
- ba'zan yengil hazil qil

O'quvchini kamsitma.
Haqorat qilma.
Qo'rqitma.

Asosiy vazifang:
o'quvchini IELTSga real tayyorlash.

O'quvchi darajasi:
${profile.level || "noma'lum"}

Maqsad bali:
${profile.target || "noma'lum"}

Muddat:
${profile.deadline || "noma'lum"}

IELTS ballarini rasmiy natija
sifatida ko'rsatma.
Taxminiy baho ekanini ayt.

Javoblarni tushunarli,
amaliy va foydali qil.
`.trim();

}


async function geminiGenerate({

  model = AI_MODEL,

  contents,

  systemInstruction,

  responseSchema

}) {

  if (!GEMINI_API_KEY) {

    throw new Error(
      "GEMINI_API_KEY sozlanmagan."
    );

  }


  const body = {
    contents
  };


  if (systemInstruction) {

    body.systemInstruction = {
      parts: [
        {
          text:
            systemInstruction
        }
      ]
    };

  }


  if (responseSchema) {

    body.generationConfig = {

      responseMimeType:
        "application/json",

      responseSchema

    };

  } else {

    body.generationConfig = {
      temperature: 0.5
    };

  }


  const response =
    await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {

        method: "POST",

        headers: {

          "x-goog-api-key":
            GEMINI_API_KEY,

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify(body)

      }
    );


  const raw =
    await response.text();


  let data;

  try {

    data =
      JSON.parse(raw);

  } catch {

    data = {
      raw
    };

  }


  if (!response.ok) {

    throw new Error(
      data?.error?.message ||
      data?.raw ||
      `Gemini error ${response.status}`
    );

  }


  const output =
    data
      ?.candidates?.[0]
      ?.content?.parts
      ?.map(
        part =>
          part.text || ""
      )
      .join("")
      .trim();


  if (!output) {

    throw new Error(
      "Gemini bo'sh javob qaytardi."
    );

  }


  return output;

}


/* =========================
   HEALTH
========================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      ok: true,

      service:
        "IELTS USTOZ AI",

      geminiConfigured:
        Boolean(
          GEMINI_API_KEY
        ),

      liveModel:
        LIVE_MODEL

    });

  }
);


/* =========================
   CHAT
========================= */

app.post(
  "/api/chat",
  async (req, res) => {

    try {

      if (
        !requireGemini(res)
      ) return;


      const {

        message,

        history = [],

        profile = {}

      } = req.body || {};


      if (
        !message?.trim()
      ) {

        return res
          .status(400)
          .json({
            error:
              "message kerak"
          });

      }


      const contents =
        history
          .slice(-12)
          .map(item => ({

            role:
              item.role ===
              "assistant"
                ? "model"
                : "user",

            parts: [
              {
                text:
                  String(
                    item.content ||
                    ""
                  )
              }
            ]

          }));


      contents.push({

        role: "user",

        parts: [
          {
            text: message
          }
        ]

      });


      const reply =
        await geminiGenerate({

          contents,

          systemInstruction:

            teacherPrompt(
              profile
            ) +

            `

O'quvchi bilan oddiy
suhbat qil.

IELTS bo'yicha
tushuntir.

Xatolarini ko'rsat.

Keraksiz uzun javob
bermasdan amaliy
maslahat ber.

Agar savol noaniq
bo'lsa, bitta
aniqlashtiruvchi
savol ber.
`

        });


      res.json({
        reply
      });


    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });

    }

  }
);


/* =========================
   DIAGNOSTIC
========================= */

const diagnosticSchema = {

  type: "object",

  properties: {

    message: {
      type: "string"
    },

    band: {
      type: "number"
    },

    strengths: {
      type: "array",
      items: {
        type: "string"
      }
    },

    weaknesses: {
      type: "array",
      items: {
        type: "string"
      }
    },

    next_steps: {
      type: "array",
      items: {
        type: "string"
      }
    },

    corrected_answer: {
      type: "string"
    }

  },

  required: [

    "message",

    "band",

    "strengths",

    "weaknesses",

    "next_steps",

    "corrected_answer"

  ]

};


app.post(
  "/api/diagnostic",
  async (req, res) => {

    try {

      if (
        !requireGemini(res)
      ) return;


      const {

        profile = {},

        answers = []

      } = req.body || {};


      const result =
        await geminiGenerate({

          contents: [

            {

              role: "user",

              parts: [

                {

                  text:
                    JSON.stringify({
                      profile,
                      answers
                    })

                }

              ]

            }

          ],

          systemInstruction:

            teacherPrompt(
              profile
            ) +

            `

Sen IELTS diagnostika
o'qituvchisisan.

O'quvchi javoblarini
tahlil qil.

Taxminiy IELTS band
ber.

Bu rasmiy IELTS
natijasi emas.

Aniqla:

- kuchli tomonlar
- zaif tomonlar
- taxminiy daraja
- keyingi mashqlar

Javob o'zbek tilida
bo'lsin.
`,

          responseSchema:
            diagnosticSchema

        });


      res.json(
        JSON.parse(result)
      );


    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });

    }

  }
);


/* =========================
   SPEAKING GRADE
========================= */

const speakingSchema = {

  type: "object",

  properties: {

    message: {
      type: "string"
    },

    band: {
      type: "number"
    },

    strengths: {
      type: "array",
      items: {
        type: "string"
      }
    },

    weaknesses: {
      type: "array",
      items: {
        type: "string"
      }
    },

    next_steps: {
      type: "array",
      items: {
        type: "string"
      }
    },

    corrected_answer: {
      type: "string"
    }

  },

  required: [

    "message",

    "band",

    "strengths",

    "weaknesses",

    "next_steps",

    "corrected_answer"

  ]

};


app.post(
  "/api/speaking/grade",
  async (req, res) => {

    try {

      if (
        !requireGemini(res)
      ) return;


      const {

        question,

        transcript,

        profile = {}

      } = req.body || {};


      if (
        !question ||
        !transcript
      ) {

        return res
          .status(400)
          .json({

            error:
              "question va transcript kerak"

          });

      }


      const result =
        await geminiGenerate({

          contents: [

            {

              role: "user",

              parts: [

                {

                  text:
                    JSON.stringify({

                      question,

                      transcript

                    })

                }

              ]

            }

          ],

          systemInstruction:

            teacherPrompt(
              profile
            ) +

            `

Sen IELTS Speaking
o'qituvchisisan.

O'quvchi javobini
IELTS Speaking
mezonlari asosida
tahlil qil.

Bahola:

1. Fluency and Coherence
2. Lexical Resource
3. Grammar
4. Pronunciation

Faqat transcript
mavjud bo'lsa,
pronunciationni
aniq baholay
olmasligingni ayt.

Taxminiy band:
0 dan 9 gacha.

0.5 qadam bilan
bahola.

O'zbekcha, sokin
va amaliy feedback
ber.
`,

          responseSchema:
            speakingSchema

        });


      res.json(
        JSON.parse(result)
      );


    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });

    }

  }
);


/* =========================
   AUDIO TRANSCRIPTION
========================= */

app.post(
  "/api/transcribe",
  upload.single("audio"),

  async (req, res) => {

    let filePath;

    try {

      if (
        !requireGemini(res)
      ) return;


      if (!req.file) {

        return res
          .status(400)
          .json({

            error:
              "audio fayl kerak"

          });

      }


      filePath =
        req.file.path;


      const bytes =
        await fs.readFile(
          filePath
        );


      const mimeType =
        req.file.mimetype ||
        "audio/webm";


      const transcript =
        await geminiGenerate({

          model:
            TRANSCRIBE_MODEL,

          contents: [

            {

              role: "user",

              parts: [

                {

                  text:
                    "Bu audio ichidagi inglizcha nutqni aniq transcript qil. Faqat aytilgan so'zlarni yoz. Izoh bermagin."

                },

                {

                  inlineData: {

                    mimeType,

                    data:
                      bytes.toString(
                        "base64"
                      )

                  }

                }

              ]

            }

          ]

        });


      res.json({
        text:
          transcript
      });


    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });

    } finally {

      if (filePath) {

        await fs.rm(
          filePath,
          {
            force: true
          }
        ).catch(
          () => {}
        );

      }

    }

  }
);


/* =========================
   GEMINI LIVE WEBSOCKET
========================= */

wss.on(
  "connection",
  browserSocket => {

    if (!GEMINI_API_KEY) {

      browserSocket.close(
        1011,
        "GEMINI_API_KEY sozlanmagan"
      );

      return;
    }


    let geminiSocket;

    let ready = false;

    let profile = {};


    const sendBrowser =
      payload => {

        if (
          browserSocket.readyState ===
          WebSocket.OPEN
        ) {

          browserSocket.send(
            JSON.stringify(
              payload
            )
          );

        }

      };


    const geminiUrl =
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(
        GEMINI_API_KEY
      )}`;


    geminiSocket =
      new WebSocket(
        geminiUrl
      );


    geminiSocket.on(
      "open",
      () => {

        geminiSocket.send(

          JSON.stringify({

            setup: {

              model:
                `models/${LIVE_MODEL}`,

              responseModalities:
                ["AUDIO"],

              inputAudioTranscription:
                {},

              outputAudioTranscription:
                {},

              systemInstruction: {

                parts: [

                  {

                    text:

                      `${teacherPrompt(
                        profile
                      )}

Bu real-time
IELTS Speaking
suhbatidir.

Sokin, tabiiy va
qisqa gapir.

O'quvchiga navbat
ber.

Savol ber.

Javobini tingla.

Kerak bo'lsa
muloyim tuzat.

Telefon orqali
suhbat qilayotgandek
tabiiy gaplash.`

                  }

                ]

              },

              generationConfig: {

                speechConfig: {

                  voiceConfig: {

                    prebuiltVoiceConfig: {

                      voiceName:
                        "Kore"

                    }

                  }

                }

              }

            }

          })

        );

      }
    );


    geminiSocket.on(
      "message",
      data => {

        let message;

        try {

          message =
            JSON.parse(
              data.toString()
            );

        } catch {

          return;

        }


        if (
          message.setupComplete
        ) {

          ready = true;

          sendBrowser({
            type: "ready"
          });

          return;

        }


        const content =
          message.serverContent;


        if (
          content?.interrupted
        ) {

          sendBrowser({
            type:
              "interrupted"
          });

        }


        if (
          content
            ?.inputTranscription
            ?.text
        ) {

          sendBrowser({

            type:
              "input_transcript",

            text:
              content
                .inputTranscription
                .text

          });

        }


        if (
          content
            ?.outputTranscription
            ?.text
        ) {

          sendBrowser({

            type:
              "output_transcript",

            text:
              content
                .outputTranscription
                .text

          });

        }


        if (
          content
            ?.modelTurn
            ?.parts
        ) {

          for (
            const part
            of content.modelTurn.parts
          ) {

            if (
              part
                .inlineData
                ?.data
            ) {

              sendBrowser({

                type:
                  "audio",

                mimeType:
                  part.inlineData
                    .mimeType ||
                  "audio/pcm;rate=24000",

                data:
                  part.inlineData
                    .data

              });

            }

          }

        }


        if (
          content?.turnComplete
        ) {

          sendBrowser({

            type:
              "turn_complete"

          });

        }

      }
    );


    geminiSocket.on(
      "error",
      error => {

        sendBrowser({

          type: "error",

          message:
            error.message ||
            "Gemini Live xatosi"

        });

      }
    );


    geminiSocket.on(
      "close",
      (code, reason) => {

        sendBrowser({

          type: "closed",

          code,

          reason:
            reason?.toString() ||
            ""

        });


        if (
          browserSocket.readyState ===
          WebSocket.OPEN
        ) {

          browserSocket.close();

        }

      }
    );


    browserSocket.on(
      "message",
      raw => {

        let message;

        try {

          message =
            JSON.parse(
              raw.toString()
            );

        } catch {

          return;

        }


        if (
          message.type ===
          "config"
        ) {

          profile =
            message.profile ||
            {};

          return;

        }


        if (
          !geminiSocket ||
          geminiSocket.readyState !==
            WebSocket.OPEN
        ) {

          return;

        }


        if (
          message.type ===
          "text" &&
          message.text?.trim()
        ) {

          geminiSocket.send(

            JSON.stringify({

              clientContent: {

                turns: [

                  {

                    role: "user",

                    parts: [

                      {

                        text:
                          message.text

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


        if (
          message.type ===
          "audio" &&
          message.data &&
          ready
        ) {

          geminiSocket.send(

            JSON.stringify({

              realtimeInput: {

                audio: {

                  data:
                    message.data,

                  mimeType:
                    "audio/pcm;rate=16000"

                }

              }

            })

          );

          return;

        }


        if (
          message.type ===
          "audio_end" &&
          ready
        ) {

          geminiSocket.send(

            JSON.stringify({

              realtimeInput: {

                audioStreamEnd:
                  true

              }

            })

          );

        }

      }
    );


    browserSocket.on(
      "close",
      () => {

        if (
          geminiSocket &&
          geminiSocket.readyState ===
            WebSocket.OPEN
        ) {

          geminiSocket.close();

        }

      }
    );

  }
);


/* =========================
   FRONTEND
========================= */

app.get(
  "/{*splat}",
  (req, res) => {

    res.sendFile(
      path.join(
        PUBLIC_DIR,
        "index.html"
      )
    );

  }
);


/* =========================
   START
========================= */

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `IELTS USTOZ AI: http://localhost:${PORT}`
    );

  }
);
