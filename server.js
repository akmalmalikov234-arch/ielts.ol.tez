import express from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";

const app = express();

const PORT = Number(
  process.env.PORT || 10000
);

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || "";

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || "";

const GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL ||
  "gemini-3.8-live";

const AI_MODEL =
  process.env.AI_MODEL ||
  "gpt-5.6-luna";

const TRANSCRIBE_MODEL =
  process.env.TRANSCRIBE_MODEL ||
  "gpt-4o-transcribe";

const TTS_MODEL =
  process.env.TTS_MODEL ||
  "gpt-4o-mini-tts";

const publicDir =
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

app.disable(
  "x-powered-by"
);

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  express.static(
    publicDir,
    {
      extensions: ["html"]
    }
  )
);


/* =====================================================
   USTOZ PROMPT
===================================================== */

function teacherPrompt(
  profile = {}
) {
  return `
Sen IELTS USTOZ AI nomli
sokin, samimiy va aqlli
IELTS o'qituvchisisan.

O'quvchi darajasi:
${profile.level || "noma'lum"}

Maqsad bali:
${profile.target || "noma'lum"}

Muddat:
${profile.deadline || "noma'lum"}

Javoblarni o'zbek tilida,
sodda va amaliy yoz.

O'quvchini kamsitma.
Qo'rqitma.
Keraksiz uzun javob bermagin.

IELTS bandini rasmiy natija
sifatida ko'rsatma.
Agar baho bersang,
taxminiy ekanini ayt.
`.trim();
}


/* =====================================================
   OPENAI
===================================================== */

function requireOpenAI(
  res
) {
  if (!OPENAI_API_KEY) {
    res.status(503).json({
      error:
        "OPENAI_API_KEY sozlanmagan."
    });

    return false;
  }

  return true;
}


async function openaiRequest(
  endpoint,
  body,
  headers = {}
) {
  const response =
    await fetch(
      `https://api.openai.com${endpoint}`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${OPENAI_API_KEY}`,

          ...headers
        },

        body
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(text);
  } catch {
    data = {
      raw: text
    };
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      data?.raw ||
      `OpenAI xatosi ${response.status}`
    );
  }

  return data;
}


/* =====================================================
   HEALTH
===================================================== */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,

      service:
        "IELTS USTOZ AI",

      geminiLiveConfigured:
        Boolean(
          GEMINI_API_KEY
        ),

      geminiLiveModel:
        GEMINI_LIVE_MODEL,

      openaiConfigured:
        Boolean(
          OPENAI_API_KEY
        )
    });
  }
);


/* =====================================================
   GEMINI LIVE TOKEN
===================================================== */

app.post(
  "/api/live-token",
  async (req, res) => {
    try {

      if (!GEMINI_API_KEY) {
        return res
          .status(503)
          .json({
            error:
              "GEMINI_API_KEY Render Environment'da sozlanmagan."
          });
      }


      const expireTime =
        new Date(
          Date.now() +
          10 * 60 * 1000
        ).toISOString();


      const newSessionExpireTime =
        new Date(
          Date.now() +
          2 * 60 * 1000
        ).toISOString();


      const response =
        await fetch(
          "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
          {
            method: "POST",

            headers: {
              "x-goog-api-key":
                GEMINI_API_KEY,

              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                uses: 1,

                expireTime,

                newSessionExpireTime,

                liveConnectConstraints: {
                  model:
                    `models/${GEMINI_LIVE_MODEL}`,

                  config: {
                    responseModalities:
                      ["AUDIO"]
                  }
                }
              })
          }
        );


      const text =
        await response.text();

      let data;

      try {
        data =
          JSON.parse(text);
      } catch {
        data = {
          raw: text
        };
      }


      if (
        !response.ok ||
        !data?.name
      ) {

        return res
          .status(502)
          .json({
            error:
              data?.error?.message ||
              data?.raw ||
              `Gemini token xatosi ${response.status}`
          });
      }


      res.json({
        token:
          data.name,

        model:
          GEMINI_LIVE_MODEL
      });

    } catch (error) {

      res
        .status(500)
        .json({
          error:
            error.message ||
            "Gemini token yaratilmadi."
        });
    }
  }
);


/* =====================================================
   CHAT
===================================================== */

app.post(
  "/api/chat",
  async (req, res) => {

    try {

      if (
        !requireOpenAI(res)
      ) {
        return;
      }


      const {
        message,
        history = [],
        profile = {}
      } =
        req.body || {};


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


      const input = [

        ...history
          .slice(-12)
          .map(
            item => ({
              role:
                item.role ===
                "assistant"
                  ? "assistant"
                  : "user",

              content: [
                {
                  type:
                    "input_text",

                  text:
                    String(
                      item.content ||
                      ""
                    )
                }
              ]
            })
          ),

        {
          role: "user",

          content: [
            {
              type:
                "input_text",

              text:
                message
            }
          ]
        }

      ];


      const result =
        await openaiRequest(
          "/v1/responses",

          JSON.stringify({

            model:
              AI_MODEL,

            instructions:
              teacherPrompt(
                profile
              ) +

              `

O'quvchi bilan foydali
suhbat qil.

IELTS bo'yicha tushuntir.

Xatolarini ko'rsat.

Keyingi amaliy qadamni ber.

Javobni ortiqcha cho'zma.
`,

            input,

            max_output_tokens:
              900

          }),

          {
            "Content-Type":
              "application/json"
          }
        );


      res.json({
        reply:
          result.output_text ||
          ""
      });

    } catch (error) {

      res
        .status(500)
        .json({
          error:
            error.message
        });
    }
  }
);


/* =====================================================
   DIAGNOSTIC
===================================================== */

app.post(
  "/api/diagnostic",
  async (req, res) => {

    try {

      if (
        !requireOpenAI(res)
      ) {
        return;
      }


      const {
        profile = {},
        answers = []
      } =
        req.body || {};


      const schema = {

        type: "object",

        additionalProperties:
          false,

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


      const result =
        await openaiRequest(
          "/v1/responses",

          JSON.stringify({

            model:
              AI_MODEL,

            instructions:
              teacherPrompt(
                profile
              ) +

              `

Sen IELTS diagnostika
o'qituvchisisan.

O'quvchi javoblarini
tahlil qil.

Taxminiy band ber.

Bu rasmiy IELTS
natijasi emas.

Kuchli tomonlari,
zaif tomonlari,
darajasi va keyingi
mashqlarni ko'rsat.

Javob o'zbek tilida
bo'lsin.
`,

            input: [
              {
                role:
                  "user",

                content: [
                  {
                    type:
                      "input_text",

                    text:
                      JSON.stringify({
                        profile,
                        answers
                      })
                  }
                ]
              }
            ],

            text: {
              format: {
                type:
                  "json_schema",

                name:
                  "diagnostic_result",

                strict:
                  true,

                schema
              }
            }

          }),

          {
            "Content-Type":
              "application/json"
          }
        );


      const output =
        result.output_text ||
        "{}";


      res.json(
        JSON.parse(
          output
        )
      );

    } catch (error) {

      res
        .status(500)
        .json({
          error:
            error.message
        });
    }
  }
);


/* =====================================================
   SPEAKING GRADE
===================================================== */

app.post(
  "/api/speaking/grade",
  async (req, res) => {

    try {

      if (
        !requireOpenAI(res)
      ) {
        return;
      }


      const {
        question,
        transcript,
        profile = {}
      } =
        req.body || {};


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


      const schema = {

        type: "object",

        additionalProperties:
          false,

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


      const result =
        await openaiRequest(
          "/v1/responses",

          JSON.stringify({

            model:
              AI_MODEL,

            instructions:
              teacherPrompt(
                profile
              ) +

              `

Sen IELTS Speaking
o'qituvchisisan.

Quyidagilarni tahlil qil:

1. Fluency and Coherence
2. Lexical Resource
3. Grammar
4. Pronunciation

Faqat transcript mavjud
bo'lsa pronunciationni
to'liq aniqlab bo'lmasligini
ayt.

0 dan 9 gacha
0.5 qadam bilan
taxminiy band ber.

Feedback o'zbek tilida
bo'lsin.
`,

            input: [
              {
                role:
                  "user",

                content: [
                  {
                    type:
                      "input_text",

                    text:
                      JSON.stringify({
                        question,
                        transcript
                      })
                  }
                ]
              }
            ],

            text: {
              format: {
                type:
                  "json_schema",

                name:
                  "speaking_grade",

                strict:
                  true,

                schema
              }
            }

          }),

          {
            "Content-Type":
              "application/json"
          }
        );


      res.json(
        JSON.parse(
          result.output_text ||
          "{}"
        )
      );

    } catch (error) {

      res
        .status(500)
        .json({
          error:
            error.message
        });
    }
  }
);


/* =====================================================
   TRANSCRIBE
===================================================== */

app.post(
  "/api/transcribe",
  upload.single("audio"),

  async (req, res) => {

    try {

      if (
        !requireOpenAI(res)
      ) {
        return;
      }


      if (!req.file) {

        return res
          .status(400)
          .json({
            error:
              "audio kerak"
          });
      }


      const buffer =
        await fs.readFile(
          req.file.path
        );


      const form =
        new FormData();


      form.append(
        "file",

        new Blob(
          [
            buffer
          ],

          {
            type:
              req.file.mimetype ||
              "audio/webm"
          }
        ),

        req.file.originalname ||
        "speaking.webm"
      );


      form.append(
        "model",
        TRANSCRIBE_MODEL
      );


      const result =
        await openaiRequest(
          "/v1/audio/transcriptions",
          form
        );


      await fs
        .unlink(
          req.file.path
        )
        .catch(
          () => {}
        );


      res.json({
        text:
          result.text ||
          ""
      });

    } catch (error) {

      if (
        req.file?.path
      ) {

        await fs
          .unlink(
            req.file.path
          )
          .catch(
            () => {}
          );
      }


      res
        .status(500)
        .json({
          error:
            error.message
        });
    }
  }
);


/* =====================================================
   TTS
===================================================== */

app.post(
  "/api/tts",
  async (req, res) => {

    try {

      if (
        !requireOpenAI(res)
      ) {
        return;
      }


      const text =
        String(
          req.body?.text ||
          ""
        ).trim();


      if (!text) {

        return res
          .status(400)
          .json({
            error:
              "text kerak"
          });
      }


      const response =
        await fetch(
          "https://api.openai.com/v1/audio/speech",

          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${OPENAI_API_KEY}`,

              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({

                model:
                  TTS_MODEL,

                voice:
                  "alloy",

                input:
                  text,

                response_format:
                  "mp3"

              })
          }
        );


      if (!response.ok) {

        const message =
          await response.text();

        throw new Error(
          message ||
          `OpenAI TTS xatosi ${response.status}`
        );
      }


      const audio =
        Buffer.from(
          await response.arrayBuffer()
        );


      res.setHeader(
        "Content-Type",
        "audio/mpeg"
      );


      res.send(
        audio
      );

    } catch (error) {

      res
        .status(500)
        .json({
          error:
            error.message
        });
    }
  }
);


/* =====================================================
   MAIN PAGE
===================================================== */

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        publicDir,
        "index.html"
      )
    );
  }
);


/* =====================================================
   START
===================================================== */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `IELTS USTOZ AI server running on port ${PORT}`
    );

  }
);
