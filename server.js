import express from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";

const app = express();

const PORT = Number(
  process.env.PORT || 10000
);

const PUBLIC_DIR = path.join(
  process.cwd(),
  "public"
);

const UPLOAD_DIR = path.join(
  process.cwd(),
  ".uploads"
);


// =====================================================
// OPENAI
// =====================================================

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || "";

const AI_MODEL =
  process.env.AI_MODEL ||
  "gpt-5.6-luna";

const TRANSCRIBE_MODEL =
  process.env.TRANSCRIBE_MODEL ||
  "gpt-4o-transcribe";

const TTS_MODEL =
  process.env.TTS_MODEL ||
  "gpt-4o-mini-tts";


// =====================================================
// GEMINI LIVE
// =====================================================

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || "";

const LIVE_MODEL =
  process.env.LIVE_MODEL ||
  "gemini-3.8-live";

const LIVE_VOICE =
  process.env.LIVE_VOICE ||
  "Kore";


// =====================================================
// UPLOAD
// =====================================================

await fs.mkdir(
  UPLOAD_DIR,
  {
    recursive: true
  }
);

const upload = multer({
  dest: UPLOAD_DIR,

  limits: {
    fileSize:
      15 * 1024 * 1024
  }
});


// =====================================================
// MIDDLEWARE
// =====================================================

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
    PUBLIC_DIR,
    {
      index: false
    }
  )
);


// =====================================================
// OPENAI HELPERS
// =====================================================

function requireOpenAI(res) {
  if (OPENAI_API_KEY) {
    return true;
  }

  res.status(503).json({
    error:
      "OPENAI_API_KEY sozlanmagan yoki OpenAI billing/credit mavjud emas."
  });

  return false;
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
      `OpenAI error ${response.status}`
    );
  }

  return data;
}


// =====================================================
// TEACHER PROMPT
// =====================================================

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
- yengil kulgili
- motivatsion
- tushunarli
- amaliy

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

Har javobda imkon qadar
aniq keyingi qadam ber.

IELTS ballarini rasmiy natija
sifatida ko'rsatma.

Agar band aytsang,
uni taxminiy baho ekanini tushuntir.
`.trim();
}


// =====================================================
// JSON SCHEMA
// =====================================================

function jsonSchemaResult(
  name,
  schema
) {
  return {
    text: {
      format: {
        type: "json_schema",
        name,
        strict: true,
        schema
      }
    }
  };
}


const gradeSchema = {
  type: "object",

  additionalProperties: false,

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


// =====================================================
// HEALTH
// =====================================================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      service:
        "IELTS USTOZ AI",

      model:
        AI_MODEL,

      liveModel:
        LIVE_MODEL
    });
  }
);


// =====================================================
// CHAT
// =====================================================

app.post(
  "/api/chat",
  async (req, res) => {
    try {
      if (!requireOpenAI(res)) {
        return;
      }

      const {
        message,
        history = [],
        profile = {}
      } = req.body || {};

      if (!message?.trim()) {
        return res.status(400).json({
          error:
            "message kerak"
        });
      }

      const safeHistory =
        Array.isArray(history)
          ? history.slice(-12)
          : [];

      const input = [
        ...safeHistory.map(
          item => ({
            role:
              item.role ===
              "assistant"
                ? "assistant"
                : "user",

            content: [
              {
                type:
                  item.role ===
                  "assistant"
                    ? "output_text"
                    : "input_text",

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
                message.trim()
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
              `${teacherPrompt(
                profile
              )}

O'quvchi bilan oddiy
suhbat qil.

IELTS bo'yicha
tushuntir.

Xatolarini ko'rsat.

Keraksiz uzun javob
bermasdan amaliy
maslahat ber.

O'quvchining darajasiga
mos misollar ber.
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
      console.error(
        "CHAT ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


// =====================================================
// DIAGNOSTIC
// =====================================================

app.post(
  "/api/diagnostic",
  async (req, res) => {
    try {
      if (!requireOpenAI(res)) {
        return;
      }

      const {
        profile = {},
        answers = []
      } = req.body || {};

      const result =
        await openaiRequest(
          "/v1/responses",

          JSON.stringify({
            model:
              AI_MODEL,

            instructions:
              `${teacherPrompt(
                profile
              )}

Sen IELTS diagnostika
o'qituvchisisan.

O'quvchi javoblarini
tahlil qil.

Taxminiy IELTS band ber.

Bu rasmiy IELTS natijasi emas.

Quyidagilarni aniqlagin:

- kuchli tomonlari
- zaif tomonlari
- taxminiy daraja
- keyingi mashqlar

Javob o'zbek tilida
bo'lsin.

Ustoz kabi sokin,
samimiy va foydali
uslubdan foydalan.
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

            ...jsonSchemaResult(
              "diagnostic_result",
              gradeSchema
            ),

            max_output_tokens:
              1200
          }),

          {
            "Content-Type":
              "application/json"
          }
        );

      const parsed =
        JSON.parse(
          result.output_text ||
          "{}"
        );

      res.json(parsed);

    } catch (error) {
      console.error(
        "DIAGNOSTIC ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


// =====================================================
// SPEAKING GRADE
// =====================================================

app.post(
  "/api/speaking/grade",
  async (req, res) => {
    try {
      if (!requireOpenAI(res)) {
        return;
      }

      const {
        question,
        transcript,
        profile = {}
      } = req.body || {};

      if (
        !question ||
        !transcript
      ) {
        return res.status(400).json({
          error:
            "question va transcript kerak"
        });
      }

      const result =
        await openaiRequest(
          "/v1/responses",

          JSON.stringify({
            model:
              AI_MODEL,

            instructions:
              `${teacherPrompt(
                profile
              )}

Sen IELTS Speaking
o'qituvchisisan.

O'quvchining javobini
IELTS Speaking mezonlari
asosida tahlil qil.

Bahola:

1. Fluency and Coherence
2. Lexical Resource
3. Grammatical Range and Accuracy
4. Pronunciation

Faqat transcript berilgan
bo'lsa pronunciationni
aniq baholab bo'lmasligini
ochiq ayt.

Taxminiy band:

0 dan 9 gacha.

0.5 qadam bilan bahola.

Bu rasmiy IELTS natijasi emas.

Feedback o'zbekcha,
sokin va foydali bo'lsin.
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

            ...jsonSchemaResult(
              "speaking_grade",
              gradeSchema
            ),

            max_output_tokens:
              1200
          }),

          {
            "Content-Type":
              "application/json"
          }
        );

      const parsed =
        JSON.parse(
          result.output_text ||
          "{}"
        );

      res.json(parsed);

    } catch (error) {
      console.error(
        "SPEAKING GRADE ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


// =====================================================
// TRANSCRIBE
// =====================================================

app.post(
  "/api/transcribe",

  upload.single("audio"),

  async (req, res) => {
    let filePath;

    try {
      if (!requireOpenAI(res)) {
        return;
      }

      if (!req.file) {
        return res.status(400).json({
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

      const form =
        new FormData();

      form.append(
        "model",
        TRANSCRIBE_MODEL
      );

      form.append(
        "language",
        "en"
      );

      form.append(
        "file",

        new Blob(
          [bytes],
          {
            type:
              req.file.mimetype ||
              "audio/webm"
          }
        ),

        req.file.originalname ||
        "speaking.webm"
      );

      const data =
        await openaiRequest(
          "/v1/audio/transcriptions",
          form
        );

      res.json({
        text:
          data.text ||
          ""
      });

    } catch (error) {
      console.error(
        "TRANSCRIBE ERROR:",
        error
      );

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


// =====================================================
// TTS
// =====================================================

app.post(
  "/api/tts",

  async (req, res) => {
    try {
      if (!requireOpenAI(res)) {
        return;
      }

      const {
        text,
        voice = "coral"
      } = req.body || {};

      if (!text?.trim()) {
        return res.status(400).json({
          error:
            "text kerak"
        });
      }

      const response =
        await fetch(
          "https://api.openai.com/v1/audio/speech",
          {
            method:
              "POST",

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

                voice,

                input:
                  text
                    .trim()
                    .slice(
                      0,
                      4000
                    ),

                response_format:
                  "mp3"
              })
          }
        );

      if (!response.ok) {
        throw new Error(
          await response.text()
        );
      }

      const buffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      res.setHeader(
        "Content-Type",
        "audio/mpeg"
      );

      res.setHeader(
        "Cache-Control",
        "no-store"
      );

      res.send(buffer);

    } catch (error) {
      console.error(
        "TTS ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


// =====================================================
// GEMINI LIVE EPHEMERAL TOKEN
// =====================================================

app.post(
  "/api/live-token",

  async (req, res) => {
    try {
      if (!GEMINI_API_KEY) {
        return res.status(503).json({
          error:
            "GEMINI_API_KEY Render Environment Variables ichida sozlanmagan."
        });
      }

      const now =
        Date.now();

      const expireTime =
        new Date(
          now +
          30 * 60 * 1000
        ).toISOString();

      const newSessionExpireTime =
        new Date(
          now +
          60 * 1000
        ).toISOString();

      const response =
        await fetch(
          "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
          {
            method:
              "POST",

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

                newSessionExpireTime
              })
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
          `Gemini token error ${response.status}`
        );
      }

      if (!data?.name) {
        throw new Error(
          "Gemini ephemeral token qaytmadi."
        );
      }

      res.json({
        token:
          data.name,

        model:
          LIVE_MODEL,

        voice:
          LIVE_VOICE,

        expiresAt:
          expireTime
      });

    } catch (error) {
      console.error(
        "GEMINI LIVE TOKEN ERROR:",
        error
      );

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


// =====================================================
// FRONTEND
// =====================================================
//
// Express 5 da "*" ishlatilmaydi.
// Shuning uchun "/{*splat}" ishlatiladi.
//
// live.js mavjud index.html ichiga
// avtomatik qo'shiladi.
//

app.get(
  "/{*splat}",

  async (
    req,
    res,
    next
  ) => {
    try {
      const indexPath =
        path.join(
          PUBLIC_DIR,
          "index.html"
        );

      let html =
        await fs.readFile(
          indexPath,
          "utf8"
        );

      if (
        !html.includes(
          'src="/live.js"'
        )
      ) {
        html =
          html.replace(
            "</body>",
            '  <script src="/live.js"></script>\n</body>'
          );
      }

      res
        .type("html")
        .send(html);

    } catch (error) {
      next(error);
    }
  }
);


// =====================================================
// ERROR HANDLER
// =====================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "SERVER ERROR:",
      error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    res.status(500).json({
      error:
        "Server xatosi",

      detail:
        error.message
    });
  }
);


// =====================================================
// START
// =====================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `IELTS USTOZ AI server running on port ${PORT}`
    );
  }
);
