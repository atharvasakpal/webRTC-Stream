const fs = require('fs');
const https = require('https');
const express = require('express');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();

// Use your actual SSL certificate and private key paths
const server = https.createServer({
  key: fs.readFileSync('/Users/atharvasakpal/Desktop/Techligence/webrtc-streaming/webrtc-streaming-privateKey.key'),
  cert: fs.readFileSync('/Users/atharvasakpal/Desktop/Techligence/webrtc-streaming/webrtc-streaming.crt')
}, app);

// CORS config
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "http://localhost:5173",
    "https://localhost:5173",
    "http://192.168.1.93:5173",
    "https://192.168.1.93:5173"
  ],
  credentials: true
}));

// Setup WebSocket over HTTPS (WSS)
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000", 
      "http://localhost:5173",
      "https://localhost:5173",
      "http://192.168.1.93:5173",
      "https://192.168.1.93:5173"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(express.json());
app.use(express.static('public'));

const clients = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  clients.set(socket.id, {
    id: socket.id,
    type: null,
    connected: true
  });

  socket.on('register', (data) => {
    const client = clients.get(socket.id);
    if (client) {
      client.type = data.type;
      console.log(`Client ${socket.id} registered as ${data.type}`);
    }
    io.emit('clients-update', Array.from(clients.values()));
  });

  socket.on('offer', (data) => {
    console.log('Offer from:', socket.id);
    socket.broadcast.emit('offer', {
      offer: data.offer,
      from: socket.id
    });
  });

  socket.on('answer', (data) => {
    console.log('Answer from:', socket.id);
    io.to(data.to).emit('answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    console.log('ICE from:', socket.id);
    if (data.to) {
      io.to(data.to).emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.id
      });
    } else {
      socket.broadcast.emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.id
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    clients.delete(socket.id);
    io.emit('clients-update', Array.from(clients.values()));
    io.emit('user-disconnected', socket.id);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    clients: clients.size,
    timestamp: new Date().toISOString()
  });
});

// Get connected clients
app.get('/api/clients', (req, res) => {
  res.json(Array.from(clients.values()));
});

// Start HTTPS server
const PORT = process.env.PORT || 5050;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔒 HTTPS + WSS server running on https://localhost:${PORT}`);
  console.log(`🩺 Health check: https://localhost:${PORT}/health`);
});
