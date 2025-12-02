const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Helper to decide difficulty ---
function inferDifficulty(baseDifficulty, questionIndex) {
  if (baseDifficulty && baseDifficulty !== "auto") return baseDifficulty;

  if (questionIndex <= 1) return "easy";
  if (questionIndex <= 3) return "medium";
  return "hard";
}

// --- Fallback dummy question (used if AI fails) ---
function buildFallbackQuestion(domain, round, baseDifficulty, questionIndex) {
  const difficulty = inferDifficulty(baseDifficulty, questionIndex);

  if (round === "aptitude") {
    return {
      round: "aptitude",
      difficulty,
      question_type: "mcq",
      question: `Sample ${difficulty} aptitude question #${questionIndex + 1} (domain: ${domain}).`,
      options: [
        "Option A (dummy)",
        "Option B (dummy - correct)",
        "Option C (dummy)",
        "Option D (dummy)"
      ],
      correct_option_index: 1,
      explanation: "This is a placeholder explanation. Later the AI will generate a real one.",
      followup_tip: "Focus on understanding the logic first, then speed."
    };
  }

  if (round === "gd") {
    return {
      round: "gd",
      difficulty,
      question_type: "open",
      question: `Dummy GD topic (${difficulty}): "Impact of technology on ${domain} jobs in India."`,
      options: [],
      correct_option_index: null,
      explanation: null,
      followup_tip: "Organise your thoughts into 2–3 clear points and give examples."
    };
  }

  if (round === "me") {
    return {
      round: "me",
      difficulty,
      question_type: "open",
      question: `Self-reflection (${difficulty}): Describe one experience that changed how you think about your career in ${domain}.`,
      options: [],
      correct_option_index: null,
      explanation: null,
      followup_tip: "Be honest and specific. Mention situation, your feelings, and what you learnt."
    };
  }

  const label = round === "hr" ? "HR" : "Technical";
  return {
    round,
    difficulty,
    question_type: "open",
    question:
      label === "HR"
        ? `(${difficulty} HR) Tell me about a time you handled a difficult situation related to ${domain}.`
        : `(${difficulty} Technical) Explain a project or concept in ${domain} that you are proud of.`,
    options: [],
    correct_option_index: null,
    explanation: null,
    followup_tip: "Use STAR: Situation → Task → Action → Result."
  };
}

// --- AI generator using Gemini 2.5 Flash ---
async function generateAiQuestion(domain, round, baseDifficulty, questionIndex, previousAnswers = []) {
  const difficulty = inferDifficulty(baseDifficulty, questionIndex);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in .env");
  }

  const prompt = `
You are an AI interview question generator.

User domain: ${domain}
Round type: ${round}
Difficulty: ${difficulty}

Your job:
- Generate ONE interview question only.
- For aptitude, generate quantitative/logical reasoning MCQs with 4 options and a correct answer.
- For technical, mix conceptual and scenario-based questions.
- For HR, ask behavioural/situational questions.
- For GD, generate a discussion topic only (no answer).
- For "me" round, generate self-reflection questions.

You MUST respond with ONLY a JSON object (no extra text) in this exact format:

{
  "round": "aptitude" | "technical" | "hr" | "gd" | "me",
  "difficulty": "easy" | "medium" | "hard",
  "question_type": "mcq" | "open",
  "question": "string",
  "options": ["A...", "B...", "C...", "D..."] or [],
  "correct_option_index": number or null,
  "explanation": "string or null",
  "followup_tip": "string or null"
}

Rules:
- For aptitude: question_type = "mcq", options length = 4, correct_option_index 0–3, explanation not null.
- For all other rounds: question_type = "open", options = [], correct_option_index = null.
- Difficulty must match "${difficulty}".
`;

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.8
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error("Gemini API error: " + errText);
  }

  const data = await response.json();

  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    data.candidates?.[0]?.content?.parts?.[0]?.data ||
    null;

  if (!text) {
    throw new Error("No content from Gemini");
  }

  // 🔥 NEW: clean ```json ... ``` wrappers if Gemini returns code fences
  let cleaned = text;
  if (typeof cleaned === "string") {
    cleaned = cleaned.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```[a-zA-Z]*\s*/, "") // remove ``` or ```json
        .replace(/```$/, "")             // remove trailing ```
        .trim();
    }
  }

  let json;
  try {
    json = typeof cleaned === "string" ? JSON.parse(cleaned) : cleaned;
  } catch (e) {
    console.error("Failed to parse JSON from Gemini:", text);
    throw new Error("Failed to parse JSON from Gemini");
  }

  return json;
}

// --- Test route (GET /) ---
app.get("/", (req, res) => {
  res.send("Backend server is running successfully 🚀");
});

// --- AI-powered next-question route ---
app.post("/api/next-question", async (req, res) => {
  const body = req.body || {};
  const domain = body.domain || "generic";
  const round = body.round || "technical";
  const baseDifficulty = body.baseDifficulty || "auto";
  const questionIndex = body.questionIndex || 0;
  const previousAnswers = body.previousAnswers || [];

  try {
    const aiQuestion = await generateAiQuestion(
      domain,
      round,
      baseDifficulty,
      questionIndex,
      previousAnswers
    );

    const difficulty = aiQuestion.difficulty || inferDifficulty(baseDifficulty, questionIndex);

    const safeResponse = {
      round: aiQuestion.round || round,
      difficulty,
      question_type: aiQuestion.question_type || (round === "aptitude" ? "mcq" : "open"),
      question: aiQuestion.question || "AI did not return a question. Please try again.",
      options: Array.isArray(aiQuestion.options) ? aiQuestion.options : [],
      correct_option_index:
        typeof aiQuestion.correct_option_index === "number"
          ? aiQuestion.correct_option_index
          : (round === "aptitude" ? 0 : null),
      explanation: aiQuestion.explanation ?? null,
      followup_tip: aiQuestion.followup_tip ?? null
    };

    return res.json(safeResponse);
  } catch (err) {
    console.error("Error generating AI question:", err.message);

    const fallback = buildFallbackQuestion(domain, round, baseDifficulty, questionIndex);
    return res.json(fallback);
  }
});

// --- Start server ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});
