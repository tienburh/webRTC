// Import cac thu vien can thiet
const express  = require('express');
const http     = require('http');
const path     = require('path');
const socketIO = require('socket.io');

const app    = express(); // Tao ung dung Express
const server = http.createServer(app); // Tao HTTP server tu Express
const io     = socketIO(server); // Khoi tao Socket.IO de gan voi HTTP server (giao tiep WebSocket giua client va server)


// Phuc vu cac file tinh trong thu muc "public"
app.use(express.static(path.join(__dirname, 'public')));

// Duong dan chinh tra ve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


let broadcaster;  // Luu lai socket ID cua broadcaster hien tai

io.on('connection', socket => {
  console.log(`🔌 New connection: ${socket.id}`);

  socket.on('broadcaster', () => {
    broadcaster = socket.id;  // Luu socket ID cua broadcaster
    console.log(`🎥 Broadcaster ready: ${broadcaster}`);

    // Gui thong bao cho tat ca cac watcher dang ket noi rang broadcaster da san sang
    socket.broadcast.emit('broadcaster');
  });


  socket.on('watcher', () => {
    console.log(`👀 Watcher connected: ${socket.id}`);
    if (broadcaster) {
      // Gui su kien den broadcaster voi ID cua watcher
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

    // Neu broadcaster roi di, reset bien
    if (socket.id === broadcaster) {
      broadcaster = null;
      console.log('⚠ Broadcaster disconnected.');
    }

    // Thong bao cho cac client con lai rang mot peer da roi khoi
    socket.broadcast.emit('disconnectPeer', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ Server is running! Access it at: https://webrtc-qlql.onrender.com//\n`);
});