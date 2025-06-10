# visiggy
An AI Powered Image Guessing game inspired by dixit

*(Prompt & Scoring now powered by **OpenAI GPT o3**)*
------------------------------------------------------------------

A lightweight web app where **GPT‑o3** invents a weird prompt, your Custom Image endpoint turns it into art, and 2‑4 teams race the clock to guess that prompt.  
Think *Pictionary* + *Codenames Pictures* with the AI doing both the clue‑giving **and** the judging.

This README is a turnkey spec & starter guide for a JavaScript‑only prototype—no TypeScript, no DB.

---

## 1.  Scope of v0

| Included | Not in v0 |
|----------|-----------|
| • Single room (host generates 6‑char code)  <br>• 5‑round game loop w/ 60s guess timer  <br>• **GPT‑o3** prompt generator  <br>• **GPT‑o3** similarity scoring  <br>• Live image via Custom AI endpoint  <br>• In‑memory state (optional JSON dump)  <br>• Express + `ws` real‑time UI | ✘ Log‑ins / DB  <br>✘ Fancy styling  <br>✘ Multi‑room scaling  <br>✘ Mobile optimizations |

---

## 2.  Tech Stack

| Layer | Choice |
|-------|--------|
| Server | Node 18+, Express, `ws`, `openai` sdk |
| Front‑end | Plain HTML, vanilla JS |
| AI Prompt / Scoring | **OpenAI GPT o3** (Chat Completion API) |
| Image Gen | Your Custom endpoint (returns image URL) |
| Persistence | In‑memory JS objects (optional disk dump) |

---

## 3.  Directory Layout

project/
│
├─ server/
│ ├─ server.js # HTTP + WS hub
│ ├─ ai.js # GPT‑o3 helpers (prompt & scoring)
│ ├─ imageGen.js # Custom AI endpoint client
│ ├─ roomsStore.js # In‑mem + optional JSON dump
│
├─ public/
│ ├─ index.html
│ ├─ app.js
│ └─ styles.css
│
├─ .env.example
└─ README.md


---

## 4.  Environment Variables

| Var | Example | Purpose |
|-----|---------|---------|
| `PORT` | `3000` | HTTP / WS port |
| `OPENAI_API_KEY` | `sk‑…` | For GPT‑o3 |
| `CUSTOM_AI_ENDPOINT` | `https://ai.example.com` | Your endpoint (no slash) |
| `CUSTOM_AI_AUTH` | `super‑secret` | `?code=` param |
| `ROOMS_FILE` | `rooms.json` | *(optional)* disk persistence |

---

## 5.  Install & Run (local)

```bash
git clone <repo>
cd <repo>
cp .env.example .env     # add keys
npm install
npm run dev              # nodemon + live reload
open http://localhost:3000


6. Game Flow
Room creation → host gets 6‑char ID.

Players join with team name.

Each round (5 total):

```
sequenceDiagram
  server->>GPT-o3: "Give me a quirky multi‑noun prompt"
  GPT-o3-->>server: prompt text
  server->>Custom AI: POST /GenerateImage  (prompt)
  Custom AI-->>server: imageUrl
  server-->>clients: round:start {imageUrl, 60s}
  clients->>server: guess:submit {team, text}
  Note right of server: after timeout or all submitted
  server->>GPT-o3: "Score these guesses vs prompt"
  GPT-o3-->>server: [{team, score}]
  server-->>clients: round:end {prompt, scores}
```

After 5 rounds → game:over with leaderboard.

7. GPT‑o3 Integration (server/ai.js)

```
import OpenAI from "openai";
const openai = new OpenAI();

export async function generatePrompt() {
  const sys = "You are a game master. Output ONE imaginative prompt " +
              "combining 2‑3 concrete nouns/ideas (e.g. 'dragon surfing on Mars').";
  const res = await openai.chat.completions.create({
    model: "gpt-o3",
    max_tokens: 25,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: "Prompt, no extra text:" }
    ]
  });
  return res.choices[0].message.content.trim()
          .replace(/^["'\s]+|["'\s]+$/g, ""); // clean quotes
}

export async function scoreGuesses(prompt, guesses) {
  /* guesses = [{team, text}]  →  returns [{team, pts (0‑1 float)}] */
  const system = "You are an impartial judge. " +
    "Given the secret prompt and a list of team guesses, " +
    "award each guess a similarity score between 0 and 1 (1 = perfect match). " +
    "Return JSON array [{team, score}].";
  const user = JSON.stringify({ prompt, guesses });
  const res = await openai.chat.completions.create({
    model: "gpt-o3",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });
  return JSON.parse(res.choices[0].message.content);
}
```

Cost note: Each round makes 2 GPT calls (prompt + scoring). Five‑round game ≈ 10 calls.

8. Image Generation (server/imageGen.js)

```
import fetch from "node-fetch";
export async function generateImage(prompt) {
  const base = process.env.CUSTOM_AI_ENDPOINT.replace(/\/$/, "");
  const url  = `${base}/api/GenerateImage?code=${process.env.CUSTOM_AI_AUTH}`;
  const body = { group:"imageguess", type:"raw", size:"1536x1024", details:prompt };

  for (let attempt = 0, wait = 10_000; attempt <= 3; attempt++) {
    const res = await fetch(url, { method:"POST", headers:{'content-type':'application/json'}, body:JSON.stringify(body) });
    if (res.ok) {
      const { imageUrl } = await res.json();
      return `${base}/${imageUrl}?code=${process.env.CUSTOM_AI_AUTH}`;
    }
    if (res.status === 500 && attempt < 3) { await new Promise(r=>setTimeout(r, wait)); wait *= 2; continue; }
    throw new Error(`Image gen failed ${res.status}: ${await res.text()}`);
  }
}

```

9. Room Store (server/roomsStore.js)

```
const fs = require("fs");
const rooms = new Map();           // {id → {id, teams:{}, stage,…}}

exports.createRoom = () => {
  const id = Math.random().toString(36).slice(2,8).toUpperCase();
  rooms.set(id, { id, stage:"lobby", teams:{}, scores:{} });
  return id;
};
exports.get = id => rooms.get(id);
exports.save = () => process.env.ROOMS_FILE && fs.writeFileSync(process.env.ROOMS_FILE, JSON.stringify([...rooms]));
exports.load = () => {
  if (!process.env.ROOMS_FILE) return;
  try { JSON.parse(fs.readFileSync(process.env.ROOMS_FILE,"utf8"))
         .forEach(([k,v])=>rooms.set(k,v)); } catch{}
};

```

10. WebSocket Events
Event	Direction	Payload
room:joined	srv → cli	{ roomId, teams }
round:start	srv → all	{ round, imageUrl, duration }
guess:submit	cli → srv	{ team, text }
round:end	srv → all	{ prompt, results:[{team, score}], leaderboard }
game:over	srv → all	{ leaderboard }
error	srv → cli	{ message }

11. Front‑end Sketch (public/app.js)

```
const ws = new WebSocket(`ws${location.protocol==='https:'?'s':''}://${location.host}`);

ws.onmessage = ev => {
  const { type, ...data } = JSON.parse(ev.data);
  if (type === 'round:start') showImage(data.imageUrl, data.duration);
  if (type === 'round:end')   showResults(data);
};

document.getElementById('submitBtn').onclick = () => {
  ws.send(JSON.stringify({ type:'guess:submit',
    team: myTeam, text: document.getElementById('guess').value }));
};

```

Basic DOM helpers & CSS are left minimal; enhance at will.

12. Future Ideas
Pre‑generate full 10‑image set to cut GPT/image latency mid‑game.

Multi‑room support with Map<roomId, state>.

React UI & Tailwind styles.

OAuth or Slack login, long‑term stats.