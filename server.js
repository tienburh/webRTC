const express  = require('express');
const http     = require('http');
const path     = require('path');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'viewer.html')); // hoặc broadcast.html để test
});

let broadcaster;

io.on('connection', socket => {
  console.log(`🔌 New connection: ${socket.id}`);

  socket.on('broadcaster', () => {
    broadcaster = socket.id;
    console.log(`🎥 Broadcaster ready: ${broadcaster}`);
    socket.broadcast.emit('broadcaster');
  });

  socket.on('watcher', () => {
    console.log(`👀 Watcher connected: ${socket.id}`);
    if (broadcaster) {
      io.to(broadcaster).emit('watcher', socket.id);
    }
  });

  socket.on('offer', (id, description) => {
    socket.to(id).emit('offer', socket.id, description);
  });

  socket.on('answer', (id, description) => {
    socket.to(id).emit('answer', socket.id, description);
  });

  socket.on('candidate', (id, candidate) => {
    socket.to(id).emit('candidate', socket.id, candidate);
  });

  socket.on('disconnect', () => {
    if (socket.id === broadcaster) broadcaster = null;
    socket.broadcast.emit('disconnectPeer', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ Server is running! Access it at: https://webrtc-qlql.onrender.com//\n`);
});
