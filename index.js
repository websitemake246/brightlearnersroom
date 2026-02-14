const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path'); // Add this
const User = require('./models/User');
const KhalidBot = require('./bot');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-app.onrender.com', 'http://localhost:5500']
      : "http://127.0.0.1:5500",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bright_learners', {
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

// API Routes
app.post('/api/register', async (req, res) => {
  // ... (same as before)
});

app.post('/api/login', async (req, res) => {
  // ... (same as before)
});

app.post('/api/rooms/create', (req, res) => {
  // ... (same as before)
});

app.get('/api/rooms', (req, res) => {
  // ... (same as before)
});

// Serve the main HTML file for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
  // ... (same as before)
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
