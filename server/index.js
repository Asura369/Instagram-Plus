import express from 'express'
import bodyParser from 'body-parser'
import mongoose from 'mongoose'
import cors from 'cors'
import dotenv from 'dotenv'
import compression from 'compression'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'

import authRoutes from './routes/auth.js'
import postRoutes from './routes/posts.js'
import userRoutes from './routes/users.js'
import uploadRoutes from './routes/upload.js'
import storyRoutes from './routes/stories.js'
import messageRoutes from './routes/messages.js'

const app = express()
dotenv.config()

const allowedOrigins = [
    'http://localhost:5173',
    'https://instaplus.up.railway.app',
]

// HTTP server
const server = http.createServer(app)

// Socket.IO server
const io = new SocketIOServer(server, {
    cors: {
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true)
            } else {
                callback(new Error('Not allowed by CORS'))
            }
        },
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    },
})

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            callback(new Error('Not allowed by CORS'))
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Origin', 'X-Requested-With', 'Accept']
}))

app.use(compression())

app.use(bodyParser.json({ limit: '30mb', extended: true }))
app.use(bodyParser.urlencoded({ limit: '30mb', extended: true }))

// Simple debug middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - Origin: ${req.get('Origin')}`);
    next();
});

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'Server is working!' })
})

app.use('/auth', authRoutes)
app.use('/posts', postRoutes)
app.use('/users', userRoutes)
app.use('/upload', uploadRoutes)
app.use('/stories', storyRoutes)
app.use('/messages', messageRoutes)

// Serve static files from the React app build directory
app.use(express.static('client'))

// Catch all handler: send back React's index.html file for any non-API routes
// Use a safer approach without wildcards
app.use((req, res, next) => {
    // Only serve index.html for GET requests that don't start with /api, /auth, etc.
    if (req.method === 'GET' &&
        !req.path.startsWith('/auth') &&
        !req.path.startsWith('/posts') &&
        !req.path.startsWith('/users') &&
        !req.path.startsWith('/upload') &&
        !req.path.startsWith('/stories') &&
        !req.path.startsWith('/test') &&
        !req.path.includes('.')) { // Skip files with extensions (CSS, JS, images)

        return res.sendFile('index.html', { root: 'client' })
    }

    // If it's an API route that doesn't exist, return 404
    next()
})

// Socket.IO Logic
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('joinConversation', (conversationId) => {
        socket.join(conversationId)
        console.log(`Socket ${socket.id} joined room ${conversationId}`)
    })

    socket.on('sendMessage', ({ conversationId, message }) => {
        socket.to(conversationId).emit('receiveMessage', message)
    })

    socket.on('editMessage', ({ conversationId, message }) => {
        socket.to(conversationId).emit('messageEdited', message)
    })

    socket.on('deleteMessage', ({ conversationId, messageId }) => {
        socket.to(conversationId).emit('messageDeleted', messageId)
    })

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
    })
})

const PORT = process.env.PORT || 5001

mongoose.connect(process.env.CONNECTION_URL)
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Server running on port: ${PORT}`)
            console.log(`Database connected: ${process.env.CONNECTION_URL}`)
        })
    })
    .catch((error) => console.log('MongoDB connection error:', error.message))
