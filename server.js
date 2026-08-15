const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.post("/api/generate", async (req, res) => {
  try {
    const { platform, strategy } = req.body;

    if (!strategy || strategy.trim().length < 10) {
      return res.status(400).json({
        error: "Please provide a detailed trading strategy."
      });
    }

    const language = platform === "MT4" ? "MQL4" : "MQL5";

    const prompt = `
You are an expert MetaTrader Expert Advisor developer.

Convert the user's trading strategy into production-quality ${language} code.

Platform: ${platform}

User strategy:
${strategy}

Requirements:
1. Generate complete compilable ${language} EA code.
2. Include proper inputs/settings.
3. Include risk management.
4. Do not invent trading rules not provided by the user.
5. Avoid martingale unless explicitly requested.
6. Return ONLY valid JSON with exactly these fields:
{
  "specification": "short strategy specification",
  "code": "complete ${language} source code"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text);

    res.json({
      platform,
      specification: result.specification,
      code: result.code
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "AI generation failed. Please try again."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`EAForge running on port ${PORT}`);
});
