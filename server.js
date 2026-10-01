import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = Number(
  process.env.PORT || 10000
);

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || "";

const LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL ||
  "gemini-3.8-live";

const TEXT_MODEL =
  process.env.GEMINI_TEXT_MODEL ||
  "gemini-3.8-flash";

const PUBLIC_DIR =
  path.join(__dirname, "public");


/* ========================================
   BASIC SERVER
======================================== */

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb"
  })
);

app.use(
  express.static(PUBLIC_DIR, {
    extensions: ["html"]
  })
);


/* ========================================
   UPLOAD
======================================== */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize:
      15 * 1024 * 1024
  }
});


/* ========================================
   API KEY
======================================== */

function requireKey(res) {
  if (!GEMINI_API_KEY) {
    res.status(500).json({
      error:
        "GEMINI_API_KEY Render Environment Variables ichida topilmadi."
    });

    return false;
  }

  return true;
}


/* ========================================
   GEMINI TEXT API
======================================== */

async function geminiGenerate(
  contents,
  systemInstruction = ""
) {
  const body = {
    contents,

    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 1600
    }
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [
        {
          text: systemInstruction
        }
      ]
    };
  }

  const response =
    await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        TEXT_MODEL
      )}:generateContent`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-goog-api-key":
            GEMINI_API_KEY
        },

        body: JSON.stringify(body)
      }
    );

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Gemini HTTP ${response.status}`;

    throw new Error(message);
  }

  const text =
    data
      ?.candidates?.[0]
      ?.content?.parts
      ?.map(
        (part) =>
          part.text || ""
      )
      .join("")
      .trim();

  if (!text) {
    throw new Error(
      "Gemini javob qaytarmadi."
    );
  }

  return text;
}


/* ========================================
   HEALTH
======================================== */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,

      service:
        "ielts-ustoz-ai",

      geminiConfigured:
        Boolean(
          GEMINI_API_KEY
        ),

      liveModel:
        LIVE_MODEL,

      textModel:
        TEXT_MODEL
    });
  }
);


/* ========================================
   GEMINI LIVE EPHEMERAL TOKEN
======================================== */

app.post(
  "/api/live-token",
  async (req, res) => {
    if (!requireKey(res)) {
      return;
    }

    try {
      const now =
        Date.now();

      const body = {
        uses: 1,

        expireTime:
          new Date(
            now +
              30 *
                60 *
                1000
          ).toISOString(),

        newSessionExpireTime:
          new Date(
            now +
              2 *
                60 *
                1000
          ).toISOString(),

        liveConnectConstraints: {
          model:
            `models/${LIVE_MODEL}`,

          config: {
            sessionResumption: {},

            responseModalities:
              ["AUDIO"]
          }
        }
      };

      const response =
        await fetch(
          "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "x-goog-api-key":
                GEMINI_API_KEY
            },

            body:
              JSON.stringify(
                body
              )
          }
        );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        const message =
          data?.error?.message ||
          `Token HTTP ${response.status}`;

        return res
          .status(response.status)
          .json({
            error: message
          });
      }

      if (!data?.name) {
        return res
          .status(502)
          .json({
            error:
              "Gemini token qaytarmadi."
          });
      }

      res.json({
        token:
          data.name,

        model:
          LIVE_MODEL
      });
    } catch (error) {
      console.error(
        "/api/live-token",
        error
      );

      res.status(500).json({
        error:
          error.message ||
          "Live token yaratib bo'lmadi."
      });
    }
  }
);


/* ========================================
   AI CHAT
======================================== */

app.post(
  "/api/chat",
  async (req, res) => {
    if (!requireKey(res)) {
      return;
    }

    const message =
      String(
        req.body?.message ||
          ""
      ).trim();

    const history =
      Array.isArray(
        req.body?.history
      )
        ? req.body.history.slice(
            -12
          )
        : [];

    if (!message) {
      return res
        .status(400)
        .json({
          error:
            "Savol bo'sh."
        });
    }

    try {
      const contents = [
        ...history
          .filter(
            (item) =>
              item &&
              (
                item.role ===
                  "user" ||
                item.role ===
                  "model"
              )
          )
          .map(
            (item) => ({
              role:
                item.role,

              parts: [
                {
                  text: String(
                    item.text ||
                      ""
                  )
                }
              ]
            })
          ),

        {
          role: "user",

          parts: [
            {
              text: message
            }
          ]
        }
      ];

      const reply =
        await geminiGenerate(
          contents,

          `
You are IELTS Ustoz AI,
a calm and friendly IELTS teacher.

Help the learner improve English.

Answer clearly and naturally.

If the user writes Uzbek,
you may explain in Uzbek
while keeping English examples.

For IELTS speaking practice,
ask one question at a time
and wait for the learner.

Do not claim to be a human.

Keep answers concise unless
the learner asks for detail.

Be supportive and practical.
          `.trim()
        );

      res.json({
        reply
      });
    } catch (error) {
      console.error(
        "/api/chat",
        error
      );

      res.status(502).json({
        error:
          error.message ||
          "AI javob bera olmadi."
      });
    }
  }
);


/* ========================================
   SPEAKING GRADE
======================================== */

app.post(
  "/api/speaking/grade",
  async (req, res) => {
    if (!requireKey(res)) {
      return;
    }

    const transcript =
      String(
        req.body?.transcript ||
          ""
      ).trim();

    const question =
      String(
        req.body?.question ||
          ""
      ).trim();

    const level =
      String(
        req.body?.level ||
          "A2-B1"
      ).trim();

    if (!transcript) {
      return res
        .status(400)
        .json({
          error:
            "Transcript bo'sh."
        });
    }

    try {
      const prompt = `
Assess this IELTS Speaking practice answer.

Target level:
${level}

Question:
${question || "Not provided"}

Learner transcript:
${transcript}

Return ONLY valid JSON with this exact shape:

{
  "band": 0,
  "fluency": 0,
  "lexical": 0,
  "grammar": 0,
  "pronunciation": 0,
  "strengths": [""],
  "corrections": [
    {
      "original": "",
      "better": "",
      "reason": ""
    }
  ],
  "nextQuestion": ""
}

Use numeric band-style scores
from 0 to 9 in 0.5 increments.

Do not pretend this is an
official IELTS score.

Pronunciation must be described
as estimated because transcript
alone cannot reliably measure
pronunciation.
      `.trim();

      const raw =
        await geminiGenerate(
          [
            {
              role: "user",

              parts: [
                {
                  text:
                    prompt
                }
              ]
            }
          ],

          `
You are an IELTS Speaking assessor.

Be evidence-based,
constructive and clear.

Do not exaggerate certainty.
          `.trim()
        );

      let cleaned =
        raw
          .replace(
            /^```json\s*/i,
            ""
          )
          .replace(
            /```\s*$/i,
            ""
          )
          .trim();

      let result;

      try {
        result =
          JSON.parse(
            cleaned
          );
      } catch {
        const match =
          cleaned.match(
            /\{[\s\S]*\}/
          );

        result =
          match
            ? JSON.parse(
                match[0]
              )
            : null;
      }

      if (!result) {
        throw new Error(
          "Baholash JSON formatida kelmadi."
        );
      }

      res.json({
        result,
        raw
      });
    } catch (error) {
      console.error(
        "/api/speaking/grade",
        error
      );

      res.status(502).json({
        error:
          error.message ||
          "Speaking baholab bo'lmadi."
      });
    }
  }
);


/* ========================================
   DIAGNOSTIC
======================================== */

app.post(
  "/api/diagnostic",
  async (req, res) => {
    if (!requireKey(res)) {
      return;
    }

    const answers =
      Array.isArray(
        req.body?.answers
      )
        ? req.body.answers
        : [];

    try {
      const prompt = `
Analyze this short IELTS diagnostic.

Answers:
${JSON.stringify(
  answers
)}

Return ONLY JSON:

{
  "estimatedLevel": "A2-B1",
  "overall": 0,
  "grammar": 0,
  "vocabulary": 0,
  "reading": 0,
  "speaking": 0,
  "plan": ["", "", ""],
  "message": ""
}

Scores are 0-9 style estimates,
not official IELTS results.
      `.trim();

      const raw =
        await geminiGenerate(
          [
            {
              role: "user",

              parts: [
                {
                  text:
                    prompt
                }
              ]
            }
          ],

          `
You are a supportive IELTS
placement tutor.

Do not exaggerate certainty.
          `.trim()
        );

      const cleaned =
        raw
          .replace(
            /^```json\s*/i,
            ""
          )
          .replace(
            /```\s*$/i,
            ""
          )
          .trim();

      const match =
        cleaned.match(
          /\{[\s\S]*\}/
        );

      const result =
        JSON.parse(
          match
            ? match[0]
            : cleaned
        );

      res.json({
        result
      });
    } catch (error) {
      console.error(
        "/api/diagnostic",
        error
      );

      res.status(502).json({
        error:
          error.message ||
          "Diagnostic hisoblanmadi."
      });
    }
  }
);


/* ========================================
   AUDIO TRANSCRIPTION
======================================== */

app.post(
  "/api/transcribe",

  upload.single("audio"),

  async (req, res) => {
    if (!requireKey(res)) {
      return;
    }

    if (!req.file) {
      return res
        .status(400)
        .json({
          error:
            "Audio fayl kelmadi."
        });
    }

    try {
      const base64 =
        req.file.buffer.toString(
          "base64"
        );

      const mimeType =
        req.file.mimetype ||
        "audio/webm";

      const raw =
        await geminiGenerate(
          [
            {
              role: "user",

              parts: [
                {
                  text:
                    "Transcribe this learner's speech exactly enough for IELTS feedback. Return only the transcript, no commentary."
                },

                {
                  inlineData: {
                    mimeType,
                    data: base64
                  }
                }
              ]
            }
          ],

          `
You are a speech transcription assistant.

Preserve the learner's actual words.

Return only the transcript.
          `.trim()
        );

      res.json({
        transcript:
          raw
      });
    } catch (error) {
      console.error(
        "/api/transcribe",
        error
      );

      res.status(502).json({
        error:
          error.message ||
          "Audio transkripsiya qilinmadi."
      });
    }
  }
);


/* ========================================
   FRONTEND FALLBACK
======================================== */

/*
  Express 5 uchun:
  "/{*splat}"

  Eski "*" ishlatilmaydi.
*/

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


/* ========================================
   ERROR HANDLER
======================================== */

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

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      error:
        error?.message ||
        "Server xatosi"
    });
  }
);


/* ========================================
   START
======================================== */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `IELTS USTOZ AI server running on port ${PORT}`
    );

    console.log(
      `Live model: ${LIVE_MODEL}`
    );

    console.log(
      `Text model: ${TEXT_MODEL}`
    );
  }
);
