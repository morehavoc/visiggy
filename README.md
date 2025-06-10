# Visiggy - AI Image Guessing Game

Visiggy is a real-time, multiplayer party game where an AI generates bizarre images from quirky prompts, and players race to guess the original prompt. It's like a creative fusion of Pictionary and Dixit, powered by AI.

 <!--- TODO: Add a real screenshot -->

---

## ✨ Features

*   **AI-Powered Fun**: Prompts and scoring are handled by **OpenAI's GPT-4o**, with image generation via a custom AI endpoint.
*   **Real-time Multiplayer**: Built with Express and WebSockets for a seamless, interactive experience.
*   **Host-led Gameplay**: A designated host controls the game flow, starting rounds and managing the room.
*   **Customizable Games**: Hosts can set the number of rounds (1-5) and an optional theme for the prompts.
*   **Engaging Lobbies**: While waiting for the image to generate, a friendly AI tells jokes every 20 seconds.
*   **Post-Game Gallery**: At the end of the game, players can view and download all the generated images.
*   **Simple & Lightweight**: No databases or complex frameworks required. Runs with just Node.js.

---

## 🛠️ Tech Stack

| Layer       | Technology                               |
|-------------|------------------------------------------|
| **Server**  | Node.js, Express, WebSocket (`ws`)       |
| **AI**      | OpenAI GPT-4o, Custom Image Generation API |
| **Frontend**| Vanilla JavaScript, HTML5, CSS3          |
| **Dev**     | `nodemon` for live reloading             |

---

## 🚀 Getting Started

### 1. Prerequisites

*   Node.js (v18 or later)
*   npm
*   Access to OpenAI API and a custom image generation endpoint.

### 2. Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/visiggy.git
    cd visiggy
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root directory by copying the example, then fill in your API keys and endpoints.
    ```bash
    cp .env.example .env
    ```
    Your `.env` file should look like this:
    ```
    PORT=3000
    OPENAI_API_KEY=sk-...
    CUSTOM_AI_ENDPOINT=https://your-image-gen-api.com
    CUSTOM_AI_AUTH=your-auth-token
    ROOMS_FILE=rooms.json
    ```

### 3. Running the Application

Start the development server with live reload:
```bash
npm run dev
```
Or run the production server:
```bash
npm start
```
The application will be available at `http://localhost:3000`.

---

## 🕹️ Game Flow

1.  **Room Creation**: A host creates a new game and receives a 6-character room code to share.
2.  **Teams Join**: Players join the room using the code and choose a team name.
3.  **Game Start**: The host selects the number of rounds, an optional theme, and starts the game.
4.  **Round Cycle**:
    *   The server pre-fetches a prompt from GPT-4o and requests an image from the custom API.
    *   While players wait, a joke is fetched from GPT-4o and displayed every 20 seconds.
    *   The round begins with a 3-second countdown, revealing the AI-generated image.
    *   A 60-second timer starts, and teams submit their guesses for the original prompt.
    *   The round ends when the timer is up or all teams have guessed.
    *   GPT-4o scores each guess based on its similarity to the prompt, and points are awarded.
    *   The results, prompt, and updated leaderboard are displayed.
5.  **Game Over**: After the final round, a game over screen shows the final leaderboard and a gallery of all images from the game.

---

## 🔌 WebSocket API

The client and server communicate over a WebSocket connection using JSON messages with a `type` field.

### Client to Server

| Type                 | Payload                                       | Description                               |
|----------------------|-----------------------------------------------|-------------------------------------------|
| `host:join`          | `{ roomId }`                                  | Host joins/reconnects to a room.          |
| `team:join`          | `{ roomId, teamName }`                        | A new team joins the lobby.               |
| `game:start`         | `{ theme, numRounds }`                        | Host starts the game with options.        |
| `guess:submit`       | `{ team, text }`                              | A team submits their guess for the round. |
| `host:skip-round`    | `{}`                                          | Host skips the current round.             |
| `host:next-round`    | `{}`                                          | Host starts the next round from results.  |
| `reconnect`          | `{ roomId, teamName, isHost }`                | A player reconnects to an active game.    |

### Server to Client

| Type                 | Payload                                                              | Description                                                              |
|----------------------|----------------------------------------------------------------------|--------------------------------------------------------------------------|
| `host:joined`        | `{ roomId, teams, stage }`                                           | Confirms host has joined.                                                |
| `team:joined`        | `{ teamName, teams }`                                                | Notifies all players that a new team has joined.                         |
| `team:confirmed`     | `{ teamName, roomId }`                                               | Confirms to a player that their team is created.                         |
| `game:started`       | `{ totalRounds }`                                                    | Notifies all players that the game has begun.                            |
| `round:next`         | `{ round }`                                                          | Announces the start of the next round.                                   |
| `round:preparing`    | `{}`                                                                 | Indicates the server is generating the image.                            |
| `joke:new`           | `{ text }`                                                           | A new joke to display during loading.                                    |
| `round:ready`        | `{ round, imageUrl, duration }`                                      | Sent when the image is ready, triggers the countdown.                    |
| `round:end`          | `{ prompt, results, leaderboard, intermission }`                     | Sent after a round, showing results and scores.                          |
| `game:over`          | `{ leaderboard, imageHistory }`                                      | Ends the game and provides the final gallery.                            |
| `score:updated`      | `{ leaderboard }`                                                    | Broadcasts an updated leaderboard after a score change.                  |
| `error`              | `{ message }`                                                        | Sends a user-facing error message.                                       |

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

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