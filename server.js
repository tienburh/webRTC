// server.js
const express  = require('express');
const http     = require('http');
const path     = require('path');
const socketIO = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = socketIO(server, { cors: { origin: '*' } });

// 1) Chỉ serve thư mục public
app.use(express.static(path.join(__dirname, 'public')));

// 2) Khi người dùng vào '/', trả về public/viewer.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
});

let broadcaster;

// --- phần signaling giống y hệt trước ---
io.on('connection', socket => {
  console.log(`🔌 New connection: ${socket.id}`);

  socket.on('broadcaster', () => {
    broadcaster = socket.id;
    console.log(`🎥 Broadcaster ready: ${broadcaster}`);
    socket.broadcast.emit('broadcaster');
  });

  socket.on('watcher', () => {
    console.log(`👀 Watcher connected: ${socket.id}`);
    if (broadcaster) io.to(broadcaster).emit('watcher', socket.id);
  });

  socket.on('offer', (id, description) => {
    io.to(id).emit('offer', socket.id, description);
  });

  socket.on('answer', (id, description) => {
    io.to(id).emit('answer', socket.id, description);
  });

  socket.on('candidate', (id, candidate) => {
    io.to(id).emit('candidate', socket.id, candidate);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    if (socket.id === broadcaster) {
      broadcaster = null;
      console.log('⚠️  Broadcaster disconnected.');
    }
    socket.broadcast.emit('disconnectPeer', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`));
