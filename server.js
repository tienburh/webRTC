const express  = require('express');
const http     = require('http');
const path     = require('path');
const socketIO = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = socketIO(server);

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let broadcaster;

io.on('connection', socket => {
  console.log(`🔌 New connection: ${socket.id}`);

  socket.on('broadcaster', () => {
    broadcaster = socket.id;
    console.log(`🎥 Broadcaster ready: ${broadcaster}`);
    socket.broadcast.emit('broadcaster'); // Thông báo cho viewer nếu đang chờ
  });

  socket.on('watcher', () => {
    console.log(`👀 Watcher connected: ${socket.id}`);
    if (broadcaster) {
      io.to(broadcaster).emit('watcher', socket.id);
    } else {
      console.log('⚠ No broadcaster found when watcher connected.');
    }
  });

  socket.on('offer', (id, description) => {
    console.log(`📨 Offer from ${socket.id} to ${id}`);
    socket.to(id).emit('offer', socket.id, description);
  });

  socket.on('answer', (id, description) => {
    console.log(`📨 Answer from ${socket.id} to ${id}`);
    socket.to(id).emit('answer', socket.id, description);
  });

  socket.on('candidate', (id, candidate) => {
    console.log(`📨 ICE candidate from ${socket.id} to ${id}`);
    socket.to(id).emit('candidate', socket.id, candidate);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    if (socket.id === broadcaster) {
      broadcaster = null;
      console.log('⚠ Broadcaster disconnected.');
    }
    socket.broadcast.emit('disconnectPeer', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ Server is running! Access it at: http://localhost:${PORT}/\n`);
});
