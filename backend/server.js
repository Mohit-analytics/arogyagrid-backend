
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
const VALID_PHCS = ["Rau PHC", "Mhow PHC", "Sanwer PHC", "Depalpur PHC"];
const VALID_MEDICINES = ["Paracetamol", "ORS", "Amoxicillin", "Iron tablets"];

app.get("/api/health", (req, res) => {
  res.json({ ok: true, geminiKeyLoaded: Boolean(GEMINI_API_KEY) });
});

app.post("/api/parse-report", async (req, res) => {
  const { report } = req.body;
  if (!report || !report.trim()) {
    return res.status(400).json({ error: "report text is required" });
  }

  const prompt = `
You extract structured data from a health worker's free-text PHC stock report.
The report may be in Hindi, English, or Hinglish.

Valid PHC names: ${VALID_PHCS.join(", ")}
Valid medicines: ${VALID_MEDICINES.join(", ")}

Report: "${report}"

Respond with ONLY a JSON object, no markdown fences, no explanation, in exactly this shape:
{"phc": "<one of the valid PHC names>", "medicine": "<one of the valid medicines>", "stock": <integer>, "dailyUse": <integer>}

If the report does not mention a daily use rate, estimate a reasonable one based on context.
If a value truly cannot be determined, use 0.
`.trim();

  try {
    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText);
      return res.status(502).json({ error: "Gemini API request failed", status: geminiRes.status });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error("Could not JSON.parse Gemini output:", text);
      return res.status(502).json({ error: "Gemini did not return valid JSON", raw: text });
    }

    if (!VALID_PHCS.includes(parsed.phc) || !VALID_MEDICINES.includes(parsed.medicine)) {
      return res.status(422).json({ error: "Could not match a known PHC or medicine", raw: parsed });
    }

    res.json(parsed);
  } catch (err) {
    console.error("Server error while parsing report:", err);
    res.status(500).json({ error: "Failed to parse report", details: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`ArogyaGrid backend running on http://localhost:${PORT}`);
  console.log(`GEMINI_API_KEY loaded: ${Boolean(GEMINI_API_KEY)}`);
});