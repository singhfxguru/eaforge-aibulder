const express=require("express");
const path=require("path");
const {GoogleGenAI}=require("@google/genai");
const app=express();
app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));
const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});

function rules(p){
return p==="MT4"?`
TARGET: MetaTrader 4 / MQL4 ONLY.
NEVER use #include <Trade/Trade.mqh>, CTrade, PositionsTotal, PositionSelect, CopyBuffer, or other MQL5-only APIs.
Use valid MQL4 trading APIs such as OrderSend, OrderClose, OrderModify, OrdersTotal and OrderSelect.
`:`
TARGET: MetaTrader 5 / MQL5 ONLY.
CTrade and #include <Trade/Trade.mqh> are allowed.
Use valid MQL5 event functions and position/order APIs.
Do not produce an MQL4-style implementation as the primary trading code.
`;}

function clean(x){return String(x||"").replace(/^```json\\s*/i,"").replace(/^```\\s*/i,"").replace(/\\s*```$/i,"").trim();}

async function ask(prompt){
const r=await ai.models.generateContent({model:"gemini-3.6-flash",contents:prompt,config:{responseMimeType:"application/json"}});
return JSON.parse(clean(r.text));
}

function wrong(p,c){
return p==="MT4"
?/#include\\s*<Trade\\/Trade\\.mqh>|\\bCTrade\\b|PositionsTotal\\s*\\(|PositionSelect\\s*\\(|CopyBuffer\\s*\\(/i.test(c)
:/\\bstart\\s*\\(\\s*\\)|\\binit\\s*\\(\\s*\\)|\\bdeinit\\s*\\(\\s*\\)|OrderClose\\s*\\(|OrderModify\\s*\\(|OrdersTotal\\s*\\(/i.test(c);
}

app.post("/api/generate",async(req,res)=>{
try{
const {platform,strategy}=req.body;
if(!["MT4","MT5"].includes(platform))return res.status(400).json({error:"Choose MT4 or MT5."});
if(!strategy||strategy.trim().length<10)return res.status(400).json({error:"Please provide a detailed strategy."});
let d=await ask(`You are a senior MetaTrader EA developer.
${rules(platform)}
Convert this strategy into COMPLETE compilable ${platform==="MT4"?"MQL4":"MQL5"} code.
Preserve the user's rules. Do not invent logic. Add clear inputs.
Audit every include, type, function and trade API for the selected platform.
Return ONLY JSON: {"specification":"short specification","code":"complete source"}
USER STRATEGY:
${strategy}`);
if(wrong(platform,d.code)){
d=await ask(`Repair this EA to STRICTLY ${platform==="MT4"?"MQL4":"MQL5"}.
${rules(platform)}
Keep the same trading strategy. Return ONLY JSON:
{"specification":"short specification","code":"complete corrected source"}
CURRENT CODE:
${d.code}`);
}
res.json({platform,specification:d.specification||"",code:d.code||""});
}catch(e){console.error(e);res.status(500).json({error:"AI generation failed."});}
});

app.post("/api/debug",async(req,res)=>{
try{
const {platform,code,errors}=req.body;
if(!["MT4","MT5"].includes(platform))return res.status(400).json({error:"Choose MT4 or MT5."});
if(!code||code.length<20)return res.status(400).json({error:"Paste EA source code."});
if(!errors||errors.length<3)return res.status(400).json({error:"Paste MetaEditor errors."});
const d=await ask(`You are an expert ${platform==="MT4"?"MQL4":"MQL5"} compiler-error debugger.
${rules(platform)}
Fix the EA using the compiler errors.
Keep the trading strategy and selected platform. Return COMPLETE corrected source.
Return ONLY JSON: {"summary":"what was fixed","code":"complete corrected source"}
COMPILER ERRORS:
${errors}
SOURCE CODE:
${code}`);
res.json(d);
}catch(e){console.error(e);res.status(500).json({error:"Debugger failed."});}
});

const PORT=process.env.PORT||3000;
app.listen(PORT,"0.0.0.0",()=>console.log("EAForge running on "+PORT));
