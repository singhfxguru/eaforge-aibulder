const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

function platformRules(platform) {
  if (platform === "MT4") {
    return `
TARGET PLATFORM: MetaTrader 4 / MQL4 ONLY.

Never use MQL5-only APIs/classes such as:
CTrade
#include <Trade/Trade.mqh>
PositionsTotal
PositionSelect
CopyBuffer

Use valid MQL4 APIs such as:
OrderSend
OrderClose
OrderModify
OrdersTotal
OrderSelect
`;
  }

  return `
TARGET PLATFORM: MetaTrader 5 / MQL5 ONLY.

CTrade and #include <Trade/Trade.mqh> are allowed.

Use valid MQL5 event functions and MQL5
position/order APIs.

Do not produce an MQL4-style implementation.
`;
}

function cleanJson(text) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function askAI(prompt) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-Lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(cleanJson(response.text));
}

function containsWrongPlatformCode(platform, code) {

  const c = String(code || "");

  if (platform === "MT4") {

    const forbidden = [
      "#include <Trade/Trade.mqh>",
      "CTrade",
      "PositionsTotal(",
      "PositionSelect(",
      "CopyBuffer("
    ];

    return forbidden.some(function(item) {
      return c.includes(item);
    });
  }

  const forbidden = [
    "OrderClose(",
    "OrderModify(",
    "OrdersTotal("
  ];

  return forbidden.some(function(item) {
    return c.includes(item);
  });
}


/* =========================
   GENERATE EA
========================= */

app.post("/api/generate", async (req, res) => {

  try {

    const { platform, strategy } = req.body;

    if (!["MT4", "MT5"].includes(platform)) {

      return res.status(400).json({
        error: "Choose MT4 or MT5."
      });

    }

    if (!strategy || strategy.trim().length < 10) {

      return res.status(400).json({
        error: "Please provide a detailed trading strategy."
      });

    }

    let result = await askAI(`

You are a senior MetaTrader Expert Advisor developer.

${platformRules(platform)}

Convert the user's strategy into COMPLETE,
compilable ${platform === "MT4" ? "MQL4" : "MQL5"} source code.

Requirements:

- Preserve the user's trading rules.
- Add clear configurable inputs where appropriate.
- Audit includes, types, functions and trading APIs.
- Do not mix MT4 and MT5 syntax.
- Return ONLY valid JSON.

JSON format:

{
  "specification": "short specification",
  "code": "complete source code"
}

USER STRATEGY:

${strategy}

`);


    /* Platform safety check */

    if (containsWrongPlatformCode(platform, result.code)) {

      result = await askAI(`

Repair this Expert Advisor so it is STRICTLY
${platform === "MT4" ? "MQL4" : "MQL5"}.

${platformRules(platform)}

Keep the same trading strategy.

Return ONLY valid JSON:

{
  "specification": "short specification",
  "code": "complete corrected source"
}

CURRENT CODE:

${result.code}

`);
    }


    res.json({

      platform: platform,

      specification: result.specification || "",

      code: result.code || ""

    });


  } catch (error) {

    console.error("Generate error:", error);

    res.status(500).json({

      error:
        "AI generation failed. Check GEMINI_API_KEY and Render logs."

    });

  }

});


/* =========================
   AI DEBUGGER
========================= */

app.post("/api/debug", async (req, res) => {

  try {

    const {
      platform,
      code,
      errors
    } = req.body;


    if (!["MT4", "MT5"].includes(platform)) {

      return res.status(400).json({
        error: "Choose MT4 or MT5."
      });

    }


    if (!code || code.length < 20) {

      return res.status(400).json({
        error: "Paste the complete EA source code."
      });

    }


    if (!errors || errors.length < 3) {

      return res.status(400).json({
        error: "Paste the MetaEditor compiler errors."
      });

    }


    const result = await askAI(`

You are an expert
${platform === "MT4" ? "MQL4" : "MQL5"}
compiler-error debugger.

${platformRules(platform)}

Fix the EA using the supplied
MetaEditor compiler errors.

Requirements:

- Keep the original trading strategy.
- Keep the selected platform.
- Fix syntax errors.
- Fix includes.
- Fix incorrect data types.
- Fix incorrect functions.
- Fix platform API mistakes.
- Return COMPLETE corrected source code.
- Do not return partial code.
- Return ONLY valid JSON.

JSON format:

{
  "summary": "what was fixed",
  "code": "complete corrected source"
}

METAEDITOR ERRORS:

${errors}

SOURCE CODE:

${code}

`);


    res.json({

      summary:
        result.summary || "Fixes applied.",

      code:
        result.code || ""

    });


  } catch (error) {

    console.error("Debugger error:", error);

    res.status(500).json({

      error:
        "AI debugger failed. Check GEMINI_API_KEY and Render logs."

    });

  }

});


/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", function() {

  console.log(
    "EAForge AI running on port " + PORT
  );

});
