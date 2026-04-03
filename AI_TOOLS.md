# 🤖 AI Tools Used

This project was built with the assistance of AI tools for code generation, architecture decisions, and debugging.

---

## Primary AI Tool

### Google DeepMind — Antigravity (Gemini)
> **Role:** End-to-end development assistant

| Detail | Info |
|---|---|
| **Tool** | Antigravity by Google DeepMind |
| **Model** | Gemini / Claude Sonnet (via Antigravity IDE) |
| **Used for** | Full project scaffolding, code generation, debugging, deployment guidance |

---

## What the AI helped build

| Area | AI Contribution |
|---|---|
| **Backend** | Designed and wrote `server.js` — Express + Socket.IO + Yjs CRDT + MongoDB |
| **Frontend architecture** | Designed component tree, hook structure, and state management |
| **Yjs integration** | Implemented the custom `SocketIOProvider.js` awareness bridge |
| **Tiptap editor** | Set up CollaborationCursor, formatting toolbar, CharacterCount |
| **CSS design system** | Generated full dark theme, animations, responsive layout |
| **Deployment guide** | Step-by-step Railway → Render → Vercel → MongoDB Atlas instructions |
| **Code comments** | Added human-readable comments across all files |
| **Git workflow** | Managed `.gitignore`, commits, and GitHub pushes |

---

## Tech stack chosen with AI guidance

| Layer | Technology | Why chosen |
|---|---|---|
| Real-time sync | **Socket.IO** | Reliable WebSocket with fallback to polling |
| CRDT engine | **Yjs** | Industry standard for conflict-free collaborative editing |
| Rich text | **Tiptap v2** | Best React-compatible editor with native Yjs support |
| Backend | **Node.js + Express** | Lightweight, works perfectly with Socket.IO |
| Database | **MongoDB + Mongoose** | Schema-flexible, free Atlas tier, easy Yjs binary storage |
| Frontend | **React + Vite** | Fast dev experience, modern tooling |
| Deployment | **Render + Vercel** | Both have free tiers; Render supports persistent WebSockets |

---

## How AI was used (honest disclosure)

- ✅ All code was **generated and explained** by the AI
- ✅ Architecture decisions were **suggested and reasoned** by the AI
- ✅ Bugs were **debugged collaboratively** with the AI
- ✅ The developer **reviewed, tested, and approved** all changes
- ✅ Deployment was **guided step-by-step** by the AI

> This reflects an honest, modern workflow where AI acts as a senior engineering pair-programmer — accelerating development without replacing human understanding and decision-making.

---

## Hackathon note

This project was submitted for the **GUVI × HCL Hackathon** — Build a Real-Time Collaborative Text Editor.

All AI assistance was used transparently as a development productivity tool, consistent with modern software engineering practices.
