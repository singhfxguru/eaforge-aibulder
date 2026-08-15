import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = process.env.PORT || 3000;
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

const SYSTEM = `
You are EAForge AI, an expert assistant for converting trading strategies into
MT4/MQL4 or MT5/MQL5 Expert Advisor specifications and source code.

Return ONLY valid JSON with keys:
platform, specification, assumptions, code, warnings.

Requirements:
- Preserve the user's rules exactly where possible.
- Ask for missing critical rules instead of silently inventing them.
- Produce complete, readable source code when enough information is available.
- Include risk controls, magic number handling, spread/slippage considerations,
  one-trade rules, and new-bar checks when relevant.
- Never claim the strategy is profitable.
- Clearly warn that generated code must be compiled, backtested and forward-tested.
- Do not place API keys or secrets in generated code.
`;

app.post("/api/generate", async (req, res) => {
  try {
    const { platform, strategy } = req.body || {};
    if (!strategy || strategy.length < 10) {
      return res.status(400).json({ error: "Please provide a detailed strategy." });
    }
    if (!["MT4", "MT5"].includes(platform)) {
      return res.status(400).json({ error: "Platform must be MT4 or MT5." });
    }

    const prompt = `Platform: ${platform}
User strategy:
${strategy}

Generate the EA specification and source code for this platform.`;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      instructions: SYSTEM,
      input: prompt
    });

    let text = response.output_text?.trim() || "";
    // Try to parse strict JSON; if the model wrapped it in a code fence, unwrap it.
    text = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = {
        platform,
        specification: "The model returned a non-JSON response.",
        assumptions: [],
        code: text,
        warnings: ["Compile and test the generated code before use."]
      };
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI generation failed. Check your API key, billing, model and server logs." });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "EAForge AI" }));

app.listen(port, () => {
  console.log(`EAForge AI running on http://localhost:${port}`);
});
