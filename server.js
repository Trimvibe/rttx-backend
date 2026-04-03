require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// ─── In-memory state ────────────────────────────────────────────────────────
let docContent = '';                  // Shared document text
const users = new Map();              // socketId → { username, color }
const AVATAR_COLORS = [
  '#6c63ff', '#ff6584', '#43e97b', '#f7971e',
  '#4facfe', '#f093fb', '#fd7043', '#00b09b',
  '#fa709a', '#a18cd1',
];

function getUserColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function getUserList() {
  return Array.from(users.entries()).map(([id, data]) => ({
    id,
    username: data.username,
    color: data.color,
  }));
}

// ─── Socket.IO events ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // Client joins with a username
  socket.on('join', (username) => {
    const color = getUserColor(users.size);
    users.set(socket.id, { username, color });
    console.log(`    → "${username}" joined (${socket.id})`);

    // Send current doc + user list to the new joiner
    socket.emit('init', {
      content: docContent,
      users: getUserList(),
    });

    // Broadcast updated user list to everyone else
    socket.broadcast.emit('user-list', getUserList());
  });

  // Client sends a text change
  socket.on('text-change', (newContent) => {
    docContent = newContent;
    // Forward to all OTHER clients (not back to sender)
    socket.broadcast.emit('text-change', newContent);
  });

  // Client started typing
  socket.on('typing', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.broadcast.emit('typing', { username: user.username, color: user.color });
    }
  });

  // Client stopped typing
  socket.on('stop-typing', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.broadcast.emit('stop-typing', { username: user.username });
    }
  });

  // Client disconnected
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`[-] "${user.username}" disconnected (${socket.id})`);
    }
    users.delete(socket.id);
    io.emit('user-list', getUserList());
  });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', users: users.size }));

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 RTTX backend running on http://localhost:${PORT}\n`);
});
