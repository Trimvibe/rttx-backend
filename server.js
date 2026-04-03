require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// Socket.IO needs to share the same HTTP server as Express,
// otherwise they'd be on different ports and that'd be a mess
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    // Allow any origin for now — lock this down in production
    // to just your Vercel URL if you want to be safe
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// ── Shared state (lives in memory, resets on server restart) ──────────────────

// The actual document text everyone is editing
let docContent = '';

// Maps socketId → { username, color }
// We use a Map instead of an object because it's faster for frequent add/delete
const users = new Map();

// A nice set of colors so each user gets their own vibe
const AVATAR_COLORS = [
  '#6c63ff', '#ff6584', '#43e97b', '#f7971e',
  '#4facfe', '#f093fb', '#fd7043', '#00b09b',
  '#fa709a', '#a18cd1',
];

// Cycle through colors so we never run out (even with 100 users)
function getUserColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

// Formats the users Map into a plain array the frontend can use
function getUserList() {
  return Array.from(users.entries()).map(([id, data]) => ({
    id,
    username: data.username,
    color: data.color,
  }));
}

// ── Socket events ──────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] New connection: ${socket.id}`);

  // Someone opened the app and entered their username
  socket.on('join', (username) => {
    const color = getUserColor(users.size);
    users.set(socket.id, { username, color });
    console.log(`    "${username}" joined (${socket.id})`);

    // Send the new user the current doc + everyone who's already here
    socket.emit('init', {
      content: docContent,
      users: getUserList(),
    });

    // Tell everyone else that a new person joined
    socket.broadcast.emit('user-list', getUserList());
  });

  // Someone typed something — save it and forward to everyone else
  // We use broadcast (not io.emit) so the sender doesn't get their own text back
  socket.on('text-change', (newContent) => {
    docContent = newContent;
    socket.broadcast.emit('text-change', newContent);
  });

  // Someone is actively typing — tell others to show the indicator
  socket.on('typing', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.broadcast.emit('typing', { username: user.username, color: user.color });
    }
  });

  // They stopped typing (after a 1.5s pause on the frontend) — hide the indicator
  socket.on('stop-typing', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.broadcast.emit('stop-typing', { username: user.username });
    }
  });

  // Browser tab closed, refreshed, or network dropped
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`[-] "${user.username}" left (${socket.id})`);
    }
    users.delete(socket.id);

    // Update everyone's user list
    io.emit('user-list', getUserList());
  });
});

// Simple health check — useful to wake up Render's free tier
// and to verify the backend is alive before debugging frontend issues
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', users: users.size });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 RTTX backend running on http://localhost:${PORT}\n`);
});
