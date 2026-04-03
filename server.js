require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Y = require('yjs');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
app.use(cors());
app.use(express.json());

// ── MongoDB setup ──────────────────────────────────────────────────────────────

const DocumentSchema = new mongoose.Schema({
  name:      { type: String, default: 'main' },
  yjsState:  Buffer,           // Binary Yjs state for full CRDT restoration
  updatedAt: { type: Date, default: Date.now },
});

const SnapshotSchema = new mongoose.Schema({
  text:      String,           // Plain text snapshot (for revision history UI)
  savedAt:   { type: Date, default: Date.now },
});

const DocumentModel = mongoose.model('Document', DocumentSchema);
const SnapshotModel = mongoose.model('Snapshot', SnapshotSchema);

const mongoEnabled = !!process.env.MONGODB_URI;
if (mongoEnabled) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('MongoDB error:', err));
}

// ── Yjs shared document ────────────────────────────────────────────────────────

// This is the server-side Yjs doc — it merges all client updates
// so new joiners can get the full current state instantly
const ydoc = new Y.Doc();

// Keep plain text snapshots in memory (last 15) for revision history
const revisionHistory = [];

async function loadDocument() {
  if (!mongoEnabled) return;
  try {
    const saved = await DocumentModel.findOne({ name: 'main' });
    if (saved?.yjsState) {
      Y.applyUpdate(ydoc, new Uint8Array(saved.yjsState));
      console.log('📄 Document restored from MongoDB');
    }
  } catch (err) {
    console.error('Failed to load document:', err);
  }
}

async function saveDocument() {
  if (!mongoEnabled) return;
  try {
    const state = Y.encodeStateAsUpdate(ydoc);
    await DocumentModel.findOneAndUpdate(
      { name: 'main' },
      { yjsState: Buffer.from(state), updatedAt: new Date() },
      { upsert: true }
    );
  } catch (err) {
    console.error('Failed to save document:', err);
  }
}

// Persist Yjs state every 30 seconds
setInterval(saveDocument, 30_000);

// ── User & awareness tracking ──────────────────────────────────────────────────

const users = new Map();   // socketId → { username, color, clientID }
const awareness = new Map(); // clientID → state (cursor etc.)

const AVATAR_COLORS = [
  '#6c63ff', '#ff6584', '#43e97b', '#f7971e',
  '#4facfe', '#f093fb', '#fd7043', '#00b09b',
  '#fa709a', '#a18cd1',
];
const getUserColor = (i) => AVATAR_COLORS[i % AVATAR_COLORS.length];
const getUserList  = () => Array.from(users.values()).map(({ username, color }) => ({ username, color }));

// ── Socket events ──────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // User entered their name and clicked "Join"
  // We receive { username, clientID } so we can map the Yjs clientID to this socket
  socket.on('join', ({ username, clientID }) => {
    const color = getUserColor(users.size);
    users.set(socket.id, { username, color, clientID });
    console.log(`    "${username}" joined`);

    // Send the new user: current Yjs state + who's online + revision history
    socket.emit('init', {
      yjsState: Array.from(Y.encodeStateAsUpdate(ydoc)),
      users:    getUserList(),
      history:  revisionHistory.slice(-15),
    });

    // Tell everyone else this person joined
    socket.broadcast.emit('user-list', getUserList());
  });

  // A client applied a local Yjs operation — merge it and relay to others
  socket.on('y-update', (update) => {
    Y.applyUpdate(ydoc, new Uint8Array(update), 'server');
    socket.broadcast.emit('y-update', update);
  });

  // Cursor / selection awareness from one client → broadcast to others
  socket.on('awareness-update', ({ clientID, state }) => {
    awareness.set(clientID, state);
    socket.broadcast.emit('awareness-update', { clientID, state });
  });

  // Client wants to save a text snapshot (called periodically from frontend)
  socket.on('save-snapshot', (text) => {
    revisionHistory.push({ text, savedAt: new Date().toISOString() });
    if (revisionHistory.length > 15) revisionHistory.shift();

    if (mongoEnabled) {
      SnapshotModel.create({ text }).catch(() => {});
    }
    // Tell all clients history updated
    io.emit('history-update', revisionHistory.slice(-15));
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    console.log(`[-] "${user?.username}" left`);

    // Clean up awareness so their cursor disappears for others
    if (user?.clientID) {
      awareness.delete(user.clientID);
      socket.broadcast.emit('awareness-remove', user.clientID);
    }
    users.delete(socket.id);
    io.emit('user-list', getUserList());
  });
});

// ── REST endpoints ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok', users: users.size }));

app.get('/history', async (_req, res) => {
  if (mongoEnabled) {
    const snaps = await SnapshotModel.find().sort({ savedAt: -1 }).limit(15);
    return res.json(snaps);
  }
  res.json(revisionHistory.slice(-15).reverse());
});

// ── Start ──────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  await loadDocument();
  console.log(`\n🚀 RTTX backend running on http://localhost:${PORT}\n`);
});
