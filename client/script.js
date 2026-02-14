// Global variables
let socket;
let currentUser = null;
let currentRoom = null;
let localStream = null;
let peerConnections = {};
let isAudioMuted = false;
let isVideoOff = false;
let isScreenSharing = false;
let meetingSidebarVisible = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    checkStoredAuth();
    setupEventListeners();
    setupDemoData();
});

// Check for stored authentication
function checkStoredAuth() {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
        currentUser = JSON.parse(userData);
        connectSocket();
        showApp();
        showNotification(`Welcome back, ${currentUser.username}!`, 'success');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await login();
    });

    // Register form
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await register();
    });

    // Global chat input
    document.getElementById('global-chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendGlobalMessage();
    });

    // Message input in meeting
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// Setup demo data for testing
function setupDemoData() {
    // Pre-populate login form with demo credentials
    document.getElementById('login-email').value = 'owner@brightlearners.com';
    document.getElementById('login-password').value = 'password123';
}

// Authentication functions
async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        showLoading(true);
        
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        // Store auth data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;

        // Connect socket
        connectSocket();

        // Show main app
        showApp();
        showNotification('Login successful!', 'success');

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function register() {
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;

    try {
        showLoading(true);
        
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password, role })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        showNotification('Registration successful! Please login.', 'success');
        
        // Switch to login tab
        switchTab('login');
        
        // Clear form
        document.getElementById('register-form').reset();

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function logout() {
    // Leave current room if in one
    if (currentRoom) {
        leaveRoom();
    }

    // Disconnect socket
    if (socket) {
        socket.disconnect();
    }

    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Reset current user
    currentUser = null;

    // Hide app and show auth
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('auth-container').classList.remove('hidden');
    
    showNotification('Logged out successfully', 'info');
}

// Socket connection
function connectSocket() {
    socket = io('http://localhost:3000', {
        auth: {
            token: localStorage.getItem('token')
        }
    });

    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('chat-message', (message) => {
        displayMessage(message);
    });

    socket.on('user-connected', ({ username, userId }) => {
        showNotification(`${username} joined the room`, 'info');
        createPeerConnection(userId);
    });

    socket.on('user-left', ({ username }) => {
        showNotification(`${username} left the room`, 'info');
        if (peerConnections[username]) {
            peerConnections[username].close();
            delete peerConnections[username];
        }
        updateParticipantsList();
    });

    socket.on('room-participants', (participants) => {
        updateParticipantsList(participants);
    });

    // WebRTC signaling
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
}

// UI Navigation
function switchTab(tab) {
    const tabs = document.querySelectorAll('.tab-btn');
    const forms = document.querySelectorAll('.auth-form');
    
    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));
    
    if (tab === 'login') {
        tabs[0].classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else {
        tabs[1].classList.add('active');
        document.getElementById('register-form').classList.add('active');
    }
}

function showSection(section) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Show selected section
    document.querySelectorAll('.section').forEach(s => {
        s.classList.remove('active');
    });
    document.getElementById(section).classList.add('active');

    // Load section-specific data
    if (section === 'dashboard') {
        loadDashboardData();
    } else if (section === 'meeting') {
        initializeMeeting();
    }
}

function showApp() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    document.getElementById('welcome-user').textContent = currentUser.username;
    document.getElementById('username-display').textContent = currentUser.username;

    // Show room creation only for owner/admin
    if (currentUser.role === 'owner' || currentUser.role === 'admin') {
        document.getElementById('room-creation').classList.remove('hidden');
    }

    loadDashboardData();
}

// Dashboard functions
async function loadDashboardData() {
    // Update stats (demo data)
    document.getElementById('active-users').textContent = Math.floor(Math.random() * 20) + 10;
    document.getElementById('active-rooms').textContent = Math.floor(Math.random() * 5) + 1;
    document.getElementById('meeting-hours').textContent = Math.floor(Math.random() * 50) + 20;

    // Load rooms
    await loadRooms();
}

async function loadRooms() {
    try {
        const response = await fetch('http://localhost:3000/api/rooms');
        const rooms = await response.json();
        
        const roomsList = document.getElementById('rooms-list');
        roomsList.innerHTML = '';

        if (rooms.length === 0) {
            roomsList.innerHTML = '<p class="no-rooms">No active rooms. Create one to start!</p>';
            return;
        }

        rooms.forEach(room => {
            const roomCard = createRoomCard(room);
            roomsList.appendChild(roomCard);
        });

    } catch (error) {
        console.error('Error loading rooms:', error);
    }
}

function createRoomCard(room) {
    const div = document.createElement('div');
    div.className = 'room-card';
    div.innerHTML = `
        <div class="room-info">
            <h4>${room.name}</h4>
            <p>${room.participants.length} participants • Created by ${room.createdBy}</p>
        </div>
        <button class="join-room-btn" onclick="joinRoom('${room.id}')">
            <i class="fas fa-sign-in-alt"></i> Join
        </button>
    `;
    return div;
}

async function createRoom() {
    const roomName = document.getElementById('room-name').value;
    
    if (!roomName) {
        showNotification('Please enter a room name', 'warning');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/rooms/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization: `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                roomName,
                createdBy: currentUser.username
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create room');
        }

        document.getElementById('room-name').value = '';
        showNotification(`Room created! ID: ${data.roomId}`, 'success');
        
        // Join the created room
        joinRoom(data.roomId);

    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Meeting functions
async function joinRoom(roomId) {
    try {
        // Get user media
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });

        // Add local video
        addVideoStream('local', currentUser.username, localStream);

        // Join room via socket
        socket.emit('join-room', {
            roomId,
            username: currentUser.username,
            userId: currentUser.id
        });

        currentRoom = roomId;
        document.getElementById('room-info').textContent = `Room: ${roomId}`;

        // Show meeting section
        showSection('meeting');
        
        showNotification(`Joined room: ${roomId}`, 'success');

    } catch (error) {
        console.error('Error joining room:', error);
        showNotification('Failed to access camera/microphone', 'error');
    }
}

function leaveRoom() {
    if (currentRoom) {
        socket.emit('leave-room', {
            roomId: currentRoom,
            username: currentUser.username
        });

        // Stop all tracks
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }

        // Close all peer connections
        Object.values(peerConnections).forEach(pc => pc.close());
        peerConnections = {};

        // Clear video grid
        document.getElementById('video-grid').innerHTML = '';

        currentRoom = null;
        document.getElementById('room-info').textContent = 'Not in a room';

        showNotification('Left the room', 'info');
    }
}

function addVideoStream(id, username, stream) {
    const videoGrid = document.getElementById('video-grid');
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    videoContainer.id = `video-${id}`;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;

    if (id !== 'local') {
        video.controls = false;
    }

    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = username;

    videoContainer.appendChild(video);
    videoContainer.appendChild(label);
    videoGrid.appendChild(videoContainer);
}

function toggleAudio() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            isAudioMuted = !audioTrack.enabled;
            
            const audioBtn = document.getElementById('audio-btn');
            if (isAudioMuted) {
                audioBtn.classList.add('muted');
                audioBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            } else {
                audioBtn.classList.remove('muted');
                audioBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            }
        }
    }
}

function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            isVideoOff = !videoTrack.enabled;
            
            const videoBtn = document.getElementById('video-btn');
            if (isVideoOff) {
                videoBtn.classList.add('muted');
                videoBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
            } else {
                videoBtn.classList.remove('muted');
                videoBtn.innerHTML = '<i class="fas fa-video"></i>';
            }
        }
    }
}

async function toggleScreenShare() {
    if (!isScreenSharing) {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                video: true 
            });
            
            const videoTrack = screenStream.getVideoTracks()[0];
            
            // Replace video track in all peer connections
            Object.values(peerConnections).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track.kind === 'video');
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            });

            // Replace local video
            const localVideo = document.querySelector('#video-local video');
            if (localVideo) {
                localVideo.srcObject = screenStream;
            }

            videoTrack.onended = () => {
                stopScreenShare();
            };

            isScreenSharing = true;
            showNotification('Screen sharing started', 'info');

        } catch (error) {
            console.error('Error sharing screen:', error);
        }
    } else {
        stopScreenShare();
    }
}

function stopScreenShare() {
    // Restore camera video
    const videoTrack = localStream.getVideoTracks()[0];
    
    Object.values(peerConnections).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track.kind === 'video');
        if (sender) {
            sender.replaceTrack(videoTrack);
        }
    });

    const localVideo = document.querySelector('#video-local video');
    if (localVideo) {
        localVideo.srcObject = localStream;
    }

    isScreenSharing = false;
    showNotification('Screen sharing stopped', 'info');
}

function toggleChat() {
    const sidebar = document.getElementById('meeting-sidebar');
    meetingSidebarVisible = !meetingSidebarVisible;
    
    if (meetingSidebarVisible) {
        sidebar.classList.remove('hidden');
        switchSidebarTab('chat');
    } else {
        sidebar.classList.add('hidden');
    }
}

function toggleParticipants() {
    const sidebar = document.getElementById('meeting-sidebar');
    meetingSidebarVisible = !meetingSidebarVisible;
    
    if (meetingSidebarVisible) {
        sidebar.classList.remove('hidden');
        switchSidebarTab('participants');
    } else {
        sidebar.classList.add('hidden');
    }
}

function switchSidebarTab(tab) {
    const tabs = document.querySelectorAll('.sidebar-tab');
    const contents = document.querySelectorAll('.sidebar-tab-content');
    
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    
    if (tab === 'chat') {
        tabs[0].classList.add('active');
        document.getElementById('sidebar-chat').classList.add('active');
    } else {
        tabs[1].classList.add('active');
        document.getElementById('sidebar-participants').classList.add('active');
    }
}

// WebRTC functions
function createPeerConnection(userId) {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    };

    const pc = new RTCPeerConnection(configuration);

    // Add local stream tracks
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                candidate: event.candidate,
                roomId: currentRoom,
                to: userId
            });
        }
    };

    // Handle incoming stream
    pc.ontrack = (event) => {
        addVideoStream(userId, `User ${userId}`, event.streams[0]);
    };

    peerConnections[userId] = pc;
    return pc;
}

async function handleOffer({ offer, from }) {
    const pc = createPeerConnection(from);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    socket.emit('answer', {
        answer,
        roomId: currentRoom,
        to: from
    });
}

async function handleAnswer({ answer, from }) {
    const pc = peerConnections[from];
    if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
}

async function handleIceCandidate({ candidate, from }) {
    const pc = peerConnections[from];
    if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
}

// Chat functions
function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();

    if (text && currentRoom) {
        socket.emit('chat-message', {
            roomId: currentRoom,
            message: { text },
            username: currentUser.username,
            userId: currentUser.id
        });

        // Display own message
        displayMessage({
            username: currentUser.username,
            text,
            timestamp: new Date(),
            userId: currentUser.id
        });

        input.value = '';
    }
}

function sendGlobalMessage() {
    const input = document.getElementById('global-chat-input');
    const text = input.value.trim();

    if (text) {
        // If in a room, send to room, otherwise just display locally
        if (currentRoom) {
            socket.emit('chat-message', {
                roomId: currentRoom,
                message: { text },
                username: currentUser.username,
                userId: currentUser.id
            });
        }

        // Display in global chat
        displayGlobalMessage({
            username: currentUser.username,
            text,
            timestamp: new Date()
        });

        input.value = '';
    }
}

function displayMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    const messageElement = createMessageElement(message);
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function displayGlobalMessage(message) {
    const chatMessages = document.getElementById('global-chat-messages');
    const messageElement = createMessageElement(message);
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `chat-message ${message.isBot ? 'bot-message' : ''}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString();
    
    div.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${message.username}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-text">${message.text}</div>
    `;
    
    return div;
}

function updateParticipantsList(participants) {
    const list = document.getElementById('participants-list');
    list.innerHTML = '';

    participants.forEach(participant => {
        const div = document.createElement('div');
        div.className = 'participant-item';
        div.innerHTML = `
            <i class="fas fa-user"></i>
            <span>${participant}</span>
            ${participant === currentUser.username ? ' (You)' : ''}
        `;
        list.appendChild(div);
    });
}

// Utility functions
function showLoading(show) {
    const loadingScreen = document.getElementById('loading-screen');
    if (show) {
        loadingScreen.classList.remove('hidden');
    } else {
        loadingScreen.classList.add('hidden');
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${getIconForType(type)}"></i>
        <span>${message}</span>
    `;

    container.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function getIconForType(type) {
    switch(type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

// Initialize meeting
function initializeMeeting() {
    // Load any necessary meeting data
    if (!localStream && currentRoom) {
        // Reinitialize if needed
    }
}
