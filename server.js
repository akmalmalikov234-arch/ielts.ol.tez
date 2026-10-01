import express from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";

const app = express();

const PORT = Number(process.env.PORT || 10000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const AI_MODEL =
  process.env.AI_MODEL || "gpt-5.6-luna";

const TRANSCRIBE_MODEL =
  process.env.TRANSCRIBE_MODEL || "gpt-4o-transcribe";

const TTS_MODEL =
  process.env.TTS_MODEL || "gpt-4o-mini-tts";

const uploadDir = path.join(process.cwd(), ".uploads");

await fs.mkdir(uploadDir, {
  recursive: true
});

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

app.use(express.json({
  limit: "1mb"
}));

app.use(
  express.static(
    path.join(process.cwd(), "public")
  )
);

function requireKey(res) {
  if (!OPENAI_API_KEY) {
    res.status(500).json({
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
  const response = await fetch(
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
    data = JSON.parse(text);
  } catch {
    data = {
      raw: text
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

function teacherPrompt(profile = {}) {
  return `
Sen IELTS USTOZ AI nomli
o'zbekcha IELTS o'qituvchisisan.

Uslubing:

- sokin
- samimiy
- kulgili
- aqlli
- realistik
- motivatsion

Ba'zan yengil hazil qil.
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
Taxminiy baho ekanini ayt.
`.trim();
}

/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "IELTS USTOZ AI"
  });
});

/* =========================
   CHAT
========================= */

app.post("/api/chat", async (req, res) => {
  try {
    if (!requireKey(res)) return;

    const {
      message,
      history = [],
      profile = {}
    } = req.body || {};

    if (!message?.trim()) {
      return res.status(400).json({
        error: "message kerak"
      });
    }

    const input = [
      ...history
        .slice(-12)
        .map(item => ({
          role:
            item.role === "assistant"
              ? "assistant"
              : "user",

          content: [
            {
              type: "input_text",
              text: String(
                item.content || ""
              )
            }
          ]
        })),

      {
        role: "user",

        content: [
          {
            type: "input_text",
            text: message
          }
        ]
      }
    ];

    const result =
      await openaiRequest(
        "/v1/responses",

        JSON.stringify({
          model: AI_MODEL,

          instructions:
            teacherPrompt(profile) +

            `

O'quvchi bilan oddiy suhbat qil.

IELTS bo'yicha tushuntir.

Xatolarini ko'rsat.

Keraksiz uzun javob bermasdan,
amaliy maslahat ber.

Agar savol noaniq bo'lsa,
bitta aniqlashtiruvchi savol ber.
`,

          input,

          max_output_tokens: 900
        }),

        {
          "Content-Type":
            "application/json"
        }
      );

    res.json({
      reply:
        result.output_text || ""
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

/* =========================
   DIAGNOSTIC
========================= */

app.post(
  "/api/diagnostic",
  async (req, res) => {
    try {
      if (!requireKey(res)) return;

      const {
        profile = {},
        answers = []
      } = req.body || {};

      const prompt =
        teacherPrompt(profile) +

        `

Sen IELTS diagnostika
o'qituvchisisan.

O'quvchi javoblarini tahlil qil.

Taxminiy IELTS band ber.

Bu rasmiy IELTS natijasi emas.

Quyidagilarni aniqlashga harakat qil:

- kuchli tomonlari
- zaif tomonlari
- taxminiy daraja
- keyingi mashqlar

Javob o'zbek tilida bo'lsin.

Ustoz kabi sokin va kulgili
uslubdan foydalan.
`;

      const result =
        await openaiRequest(
          "/v1/responses",

          JSON.stringify({
            model: AI_MODEL,

            instructions: prompt,

            input: [
              {
                role: "user",

                content: [
                  {
                    type: "input_text",

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
                type: "json_schema",

                name:
                  "diagnostic_result",

                strict: true,

                schema: {
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
                }
              }
            }
          }),

          {
            "Content-Type":
              "application/json"
          }
        );

      const text =
        result.output_text || "";

      res.json(
        JSON.parse(text)
      );

    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================
   SPEAKING GRADE
========================= */

app.post(
  "/api/speaking/grade",
  async (req, res) => {
    try {
      if (!requireKey(res)) return;

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

      const instructions =
        teacherPrompt(profile) +

        `

Sen IELTS Speaking
o'qituvchisisan.

O'quvchining javobini
IELTS Speaking mezonlari
asosida tahlil qil.

Bahola:

1. Fluency and Coherence
2. Lexical Resource
3. Grammar
4. Pronunciation

Lekin faqat transcript mavjud bo'lsa,
pronunciationni aniq baholay
olmasligingni ayt.

Taxminiy band:

0 dan 9 gacha.

0.5 qadam bilan bahola.

O'quvchiga o'zbekcha
sokin va kulgili tarzda
feedback ber.
`;

      const result =
        await openaiRequest(
          "/v1/responses",

          JSON.stringify({
            model: AI_MODEL,

            instructions,

            input: [
              {
                role: "user",

                content: [
                  {
                    type: "input_text",

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
                type: "json_schema",

                name:
                  "speaking_grade",

                strict: true,

                schema: {
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
                }
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
          result.output_text
        )
      );

    } catch (error) {
      res.status(500).json({
        error: error.message
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
      if (!requireKey(res)) return;

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
          data.text || ""
      });

    } catch (error) {
      res.status(500).json({
        error: error.message
      });

    } finally {
      if (filePath) {
        await fs.rm(
          filePath,
          {
            force: true
          }
        ).catch(() => {});
      }
    }
  }
);

/* =========================
   TEXT TO SPEECH
========================= */

app.post(
  "/api/tts",
  async (req, res) => {
    try {
      if (!requireKey(res)) return;

      const {
        text,
        voice = "coral"
      } = req.body || {};

      if (!text?.trim()) {
        return res.status(400).json({
          error: "text kerak"
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

            body: JSON.stringify({
              model: TTS_MODEL,

              voice,

              input:
                text.slice(0, 4000),

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

      res.send(buffer);

    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================
   FRONTEND
========================= */

app.get("*", (req, res) => {
  res.sendFile(
    path.join(
      process.cwd(),
      "public",
      "index.html"
    )
  );
});

app.listen(
  PORT,
  () => {
    console.log(
      `IELTS USTOZ AI: http://localhost:${PORT}`
    );
  }
);
