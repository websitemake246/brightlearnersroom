const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('./models/User');
const KhalidBot = require('./bot');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "http://127.0.0.1:5500",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: "http://127.0.0.1:5500",
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/bright_learners', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

// Initialize Khalid Bot
const khalidBot = new KhalidBot(io);

// Store active rooms
const rooms = new Map();

// Authentication Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: role || 'teacher'
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      'your_jwt_secret_key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      'your_jwt_secret_key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Room management routes
app.post('/api/rooms/create', (req, res) => {
  const { roomName, createdBy } = req.body;
  const roomId = uuidv4().substring(0, 8);
  
  rooms.set(roomId, {
    id: roomId,
    name: roomName,
    createdBy,
    createdAt: new Date(),
    participants: []
  });

  res.json({ roomId, roomName });
});

app.get('/api/rooms', (req, res) => {
  const roomsList = Array.from(rooms.values());
  res.json(roomsList);
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
  console.log('🟢 User connected:', socket.id);

  socket.on('join-room', ({ roomId, username, userId }) => {
    socket.join(roomId);
    
    // Add to room participants
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (!room.participants.includes(username)) {
        room.participants.push(username);
      }
    }

    // Notify others in the room
    socket.to(roomId).emit('user-connected', { username, userId });
    
    // Send room participants list
    const room = rooms.get(roomId);
    io.to(roomId).emit('room-participants', room?.participants || []);

    console.log(`👤 ${username} joined room: ${roomId}`);
  });

  socket.on('leave-room', ({ roomId, username }) => {
    socket.leave(roomId);
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.participants = room.participants.filter(p => p !== username);
      
      // Notify others
      socket.to(roomId).emit('user-left', { username });
      io.to(roomId).emit('room-participants', room.participants);
    }

    console.log(`👋 ${username} left room: ${roomId}`);
  });

  // WebRTC signaling
  socket.on('offer', ({ offer, roomId, to }) => {
    socket.to(to).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ answer, roomId, to }) => {
    socket.to(to).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ candidate, roomId, to }) => {
    socket.to(to).emit('ice-candidate', { candidate, from: socket.id });
  });

  // Chat messages
  socket.on('chat-message', ({ roomId, message, username, userId }) => {
    // Check if it's a bot command
    if (message.text.startsWith('.')) {
      khalidBot.handleMessage(roomId, username, message.text);
    } else {
      // Regular message
      io.to(roomId).emit('chat-message', {
        username,
        text: message.text,
        timestamp: new Date(),
        userId
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
