const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;

// Mapping MIME types for static file serving
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// 1. Create Native HTTP Server to serve Frontend Assets
const server = http.createServer((req, res) => {
    let filePath = req.url === '/' 
        ? path.join(__dirname, '../client/index.html') 
        : path.join(__dirname, '../client', req.url);

    const extname = String(path.extname(filePath)).toLowerCase();
    let contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // Page not found
                fs.readFile(path.join(__dirname, '../client/index.html'), (err, htmlContent) => {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(htmlContent, 'utf-8');
                });
            } else {
                // Server Error
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`);
            }
        } else {
            // Success
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 2. Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// In-memory data store for active user tracking
const activeUsers = new Map();

// Helper to sanitize inputs and remove malicious markup
function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
}

io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Handle User Attempting to Join Room
    socket.on('user-joined', (userData, callback) => {
        try {
            if (!userData || typeof userData !== 'object') {
                return callback({ success: false, error: 'Invalid user payload.' });
            }

            const name = sanitizeString(userData.name);
            const gender = sanitizeString(userData.gender);

            // Backend Validations
            if (!name || name.length < 2) {
                return callback({ success: false, error: 'Name must be at least 2 characters.' });
            }
            if (name.length > 25) {
                return callback({ success: false, error: 'Name cannot exceed 25 characters.' });
            }
            if (!['Male', 'Female', 'Other'].includes(gender)) {
                return callback({ success: false, error: 'Invalid gender selection.' });
            }

            // Save user profile state linked to socket ID
            const userProfile = { id: socket.id, name, gender };
            activeUsers.set(socket.id, userProfile);

            // Acknowledge validation success back to the caller
            callback({ success: true, profile: userProfile });

            // Broadcast join notification to other active sockets
            socket.broadcast.emit('receive-message', {
                system: true,
                text: `${name} has joined the chat room.`
            });

            // Synchronize updated active users list layout across all instances
            io.emit('update-users', Array.from(activeUsers.values()));

        } catch (err) {
            console.error('Error in user-joined handler:', err);
            callback({ success: false, error: 'Internal Server Error encountered.' });
        }
    });

    // Handle Messages
    socket.on('send-message', (messageText, callback) => {
        try {
            const user = activeUsers.get(socket.id);
            if (!user) {
                return callback({ success: false, error: 'Unauthenticated session.' });
            }

            const cleanMessage = sanitizeString(messageText);

            if (!cleanMessage || cleanMessage.length === 0) {
                return callback({ success: false, error: 'Message content cannot be blank.' });
            }
            if (cleanMessage.length > 500) {
                return callback({ success: false, error: 'Message threshold exceeded (max 500 characters).' });
            }

            const outgoingPayload = {
                system: false,
                id: socket.id,
                name: user.name,
                gender: user.gender,
                text: cleanMessage,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            // Propagate message payload to everyone inclusive of sender
            io.emit('receive-message', outgoingPayload);
            callback({ success: true });

        } catch (err) {
            console.error('Error in send-message handler:', err);
            callback({ success: false, error: 'Failed to process message transmission.' });
        }
    });

    // Handle Disconnections cleanly
    socket.on('disconnect', () => {
        const user = activeUsers.get(socket.id);
        if (user) {
            activeUsers.delete(socket.id);
            
            // Broadcast systematic notification
            io.emit('receive-message', {
                system: true,
                text: `${user.name} has left the room.`
            });

            // Synchronize updated array maps
            io.emit('update-users', Array.from(activeUsers.values()));
        }
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

// Run server
server.listen(PORT, () => {
    console.log(`EtharaChats backend running flawlessly at http://localhost:${PORT}`);
});