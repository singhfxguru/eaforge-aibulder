EAForge AI — real AI backend MVP

1) Install Node.js 18+.
2) Open terminal in this folder.
3) Run: npm install
4) Copy .env.example to .env
5) Put your OpenAI API key ONLY in .env. Never put it in public HTML/JS or commit it.
6) Run: npm start
7) Open: http://localhost:3000

The backend uses the official OpenAI JavaScript SDK and the Responses API.
Before production: add authentication, rate limits, usage limits, billing, logging,
structured-output validation, code compilation in an isolated sandbox, and security review.
