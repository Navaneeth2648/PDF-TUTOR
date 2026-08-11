// PDF Tutor - Express backend
// Serves the frontend and handles /api/ask and /api/explain.
// Gemini API key is read only from the server environment.

require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

app.use(express.json({ limit: "10mb" }));

// Serve frontend files from the project ROOT directory.
// index.html, style.css and app.js are in the same folder as server.js.
app.use(express.static(__dirname));

// Explicitly serve index.html when opening the main website.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ---- Helper: call Gemini API ----
async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    const err = new Error(
      "AI is not configured on the server. Please set GEMINI_API_KEY."
    );
    err.isConfigError = true;
    throw err;
  }

  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    let details = "";

    try {
      const errBody = await response.json();
      details = errBody?.error?.message || "";
    } catch (_) {
      // Ignore JSON parsing errors
    }

    console.error("Gemini API error:", response.status, details);

    const err = new Error(
      "The AI service failed to respond. Please try again."
    );

    throw err;
  }

  const data = await response.json();

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .join("\n");

  if (!text) {
    const err = new Error(
      "The AI service returned an empty response. Please try again."
    );

    throw err;
  }

  return text.trim();
}

// ---- POST /api/ask ----
app.post("/api/ask", async (req, res) => {
  try {
    const { question, pdfText } = req.body || {};

    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Please enter a question.",
      });
    }

    if (
      !pdfText ||
      typeof pdfText !== "string" ||
      pdfText.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "No PDF content was provided.",
      });
    }

    const prompt = `You are a PDF study assistant.

Answer the user's question using the provided content from their uploaded PDF.

Use the PDF content as the primary source.
Do not invent facts that are not supported by the provided PDF.
If the answer cannot be found in the provided PDF content, clearly say that the answer could not be found in the uploaded PDF.
If the PDF contains relevant information in multiple places, combine the relevant information into one clear answer.
Explain the answer in simple language suitable for a college student.
Do not claim that information came from the PDF if it was not found there.

PDF CONTENT:
"""
${pdfText.slice(0, 20000)}
"""

QUESTION:
${question.trim()}`;

    const answer = await callGemini(prompt);

    return res.json({
      success: true,
      answer,
    });
  } catch (err) {
    console.error("Error in /api/ask:", err.message);

    if (err.isConfigError) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }

    return res.status(502).json({
      success: false,
      error:
        "Something went wrong while getting the answer. Please try again.",
    });
  }
});

// ---- POST /api/explain ----
app.post("/api/explain", async (req, res) => {
  try {
    const { selectedLine, pdfContext } = req.body || {};

    if (
      !selectedLine ||
      typeof selectedLine !== "string" ||
      selectedLine.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Please enter a sentence to explain.",
      });
    }

    const context =
      pdfContext && typeof pdfContext === "string"
        ? pdfContext.slice(0, 12000)
        : "";

    const prompt = `You are helping a college student understand a difficult sentence.

Explain the provided sentence in very simple language.
Preserve the original meaning.
Avoid unnecessary technical terminology.
Break complicated ideas into simple parts.
Give a short example when useful.
Use the provided PDF context when relevant.
Do not introduce unrelated information.

${
  context
    ? `PDF CONTEXT:
"""
${context}
"""

`
    : ""
}SENTENCE TO EXPLAIN:
${selectedLine.trim()}`;

    const explanation = await callGemini(prompt);

    return res.json({
      success: true,
      explanation,
    });
  } catch (err) {
    console.error("Error in /api/explain:", err.message);

    if (err.isConfigError) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }

    return res.status(502).json({
      success: false,
      error:
        "Something went wrong while generating the explanation. Please try again.",
    });
  }
});

// ---- Fallback 404 for unknown API routes ----
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Not found.",
  });
});

// ---- Generic error handler ----
app.use((err, req, res, next) => {
  console.error("Unexpected server error:", err);

  res.status(500).json({
    success: false,
    error: "Unexpected server error. Please try again.",
  });
});

// ---- Start server ----
app.listen(PORT, () => {
  console.log(`PDF Tutor server running on port ${PORT}`);

  if (!GEMINI_API_KEY) {
    console.warn(
      "WARNING: GEMINI_API_KEY is not configured. AI features will not work."
    );
  }
});
