import express from 'express'
import bodyParser from 'body-parser'
import mongoose from 'mongoose'
import cors from 'cors'
import dotenv from 'dotenv'
import compression from 'compression'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import validateEnvironment from './utils/validateEnv.js'

import authRoutes from './routes/auth.js'
import postRoutes from './routes/posts.js'
import userRoutes from './routes/users.js'
import uploadRoutes from './routes/upload.js'
import storyRoutes from './routes/stories.js'
import messageRoutes from './routes/messages.js'

const app = express()
dotenv.config()

// Validate environment variables
validateEnvironment();

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
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
        credentials: true
    },
})

// Enhanced CORS middleware for production
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
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'x-auth-token', 
        'Origin', 
        'X-Requested-With', 
        'Accept',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Credentials',
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Methods'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    preflightContinue: false,
    optionsSuccessStatus: 204
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

// Image proxy route to handle CORS issues
app.get('/proxy-image', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        // Validate URL to prevent SSRF attacks
        const allowedDomains = [
            'res.cloudinary.com',
            'upload.wikimedia.org',
            'images.unsplash.com',
            'via.placeholder.com'
        ];

        const urlObj = new URL(url);
        if (!allowedDomains.some(domain => urlObj.hostname.includes(domain))) {
            return res.status(403).json({ error: 'Domain not allowed' });
        }

        const response = await fetch(url);
        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch image' });
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            return res.status(400).json({ error: 'URL does not point to an image' });
        }

        // Set appropriate headers
        res.set({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            'Access-Control-Allow-Origin': '*'
        });

        // Pipe the image data
        response.body.pipe(res);
    } catch (error) {
        console.error('Image proxy error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
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

const PORT = process.env.PORT || 5000

mongoose.connect(process.env.CONNECTION_URL)
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Server running on port: ${PORT}`)
            console.log(`Database connected: ${process.env.CONNECTION_URL}`)
        })
    })
    .catch((error) => console.log('MongoDB connection error:', error.message))
