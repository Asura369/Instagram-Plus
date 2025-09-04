import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { io } from 'socket.io-client'
import './Messages.css'
import { API_BASE_URL, API_ENDPOINTS } from '../config/api'

const socket = io(API_BASE_URL)

const Messages = () => {
    const [conversations, setConversations] = useState([])
    const [selectedConv, setSelectedConv] = useState(null)
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [currentUserId, setCurrentUserId] = useState(null)
    const [showNewMsgModal, setShowNewMsgModal] = useState(false)
    const [usersList, setUsersList] = useState([])

    const [editingMessageId, setEditingMessageId] = useState(null)
    const [editText, setEditText] = useState('')

    const textareaRef = useRef(null)
    const editTextareaRef = useRef(null)
    const messagesEndRef = useRef(null)
    const navigate = useNavigate()

    const token = localStorage.getItem('token')

    const maxChars = 1000
    const maxNewlines = 10

    const prevSelectedConvId = useRef(null)
    const prevMessagesLength = useRef(0)
    const skipScrollRef = useRef(false)

    // Fetch user and conversations on load
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(API_ENDPOINTS.profile, {
                    headers: { Authorization: `Bearer ${token}` },
                })
                setCurrentUserId(res.data._id)
            } catch (err) {
                console.error('Error loading profile:', err)
            }
        }

        const fetchConversations = async () => {
            try {
                const res = await axios.get(API_ENDPOINTS.messagesConversations, {
                    headers: { Authorization: `Bearer ${token}` },
                })
                setConversations(res.data)
            } catch (err) {
                console.error('Error loading conversations:', err)
            }
        }

        fetchData()
        fetchConversations()
    }, [token])

    // Fetch messages when conversation changes
    useEffect(() => {
        const fetchMessages = async () => {
            if (!selectedConv) return
            try {
                const res = await axios.get(API_ENDPOINTS.messagesById(selectedConv._id), {
                    headers: { Authorization: `Bearer ${token}` },
                })
                setMessages(res.data)
            } catch (err) {
                console.error('Failed to load messages:', err)
            }
        }

        fetchMessages()
    }, [selectedConv, token])

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }, [newMessage])

    useEffect(() => {
        if (editTextareaRef.current) {
            editTextareaRef.current.style.height = 'auto'
            editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`
        }
    }, [editText])

    // WebSocket: join room and listen for incoming messages, edits, deletes
    useEffect(() => {
        if (!selectedConv) return

        socket.emit('joinConversation', selectedConv._id)

        socket.on('receiveMessage', (message) => {
            setMessages((prev) => [...prev, message])
        })

        socket.on('messageEdited', (editedMessage) => {
            setMessages((prev) =>
                prev.map((m) => (m._id === editedMessage._id ? editedMessage : m))
            )
        })

        socket.on('messageDeleted', (deletedMessageId) => {
            setMessages((prev) => prev.filter((m) => m._id !== deletedMessageId))
        })

        return () => {
            socket.off('receiveMessage')
            socket.off('messageEdited')
            socket.off('messageDeleted')
        }
    }, [selectedConv])

    // Auto scroll on new message or convo change
    useEffect(() => {
        if (!messagesEndRef.current) return

        const convoChanged = prevSelectedConvId.current !== selectedConv?._id
        prevSelectedConvId.current = selectedConv?._id

        if (convoChanged) {
            messagesEndRef.current.scrollIntoView({ behavior: 'instant' })
            prevMessagesLength.current = messages.length
            skipScrollRef.current = false
            return
        }

        if (skipScrollRef.current) {
            skipScrollRef.current = false
            prevMessagesLength.current = messages.length
            return
        }

        if (messages.length > prevMessagesLength.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'instant' })
        }

        prevMessagesLength.current = messages.length
    }, [messages, selectedConv])

    const disableScrollAfterEditOrDelete = () => {
        skipScrollRef.current = true
    }

    const sendMessage = async () => {
        if (!newMessage.trim()) return
        try {
            const res = await axios.post(
                API_ENDPOINTS.messagesById(selectedConv._id),
                { text: newMessage },
                { headers: { Authorization: `Bearer ${token}` } }
            )

            const sentMessage = res.data

            setMessages((prev) => [...prev, sentMessage])
            setNewMessage('')
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'
            }

            // Emit message to others in the room
            socket.emit('sendMessage', {
                conversationId: selectedConv._id,
                message: sentMessage,
            })
        } catch (err) {
            console.error('Failed to send message:', err)
        }
    }

    const handleChange = (e) => {
        const value = e.target.value
        const numNewlines = (value.match(/\n/g) || []).length
        if (value.length <= maxChars && numNewlines <= maxNewlines) {
            setNewMessage(value)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const deleteMessage = async (messageId) => {
        try {
            await axios.delete(API_ENDPOINTS.deleteMessage(messageId), {
                headers: { Authorization: `Bearer ${token}` },
            })
            setMessages((prev) => prev.filter((m) => m._id !== messageId))
            disableScrollAfterEditOrDelete()

            // Emit delete event to others
            socket.emit('deleteMessage', { conversationId: selectedConv._id, messageId })
        } catch (err) {
            console.error('Failed to delete message:', err)
        }
    }

    const startEdit = (msg) => {
        setEditingMessageId(msg._id)
        setEditText(msg.text)
    }

    const saveEdit = async () => {
        if (!editText.trim()) return
        try {
            const res = await axios.patch(
                API_ENDPOINTS.editMessage(editingMessageId),
                { text: editText },
                { headers: { Authorization: `Bearer ${token}` } }
            )
            setMessages((prev) => prev.map((m) => (m._id === editingMessageId ? res.data : m)))
            setEditingMessageId(null)
            setEditText('')
            disableScrollAfterEditOrDelete()

            // Emit edit event to others
            socket.emit('editMessage', { conversationId: selectedConv._id, message: res.data })
        } catch (err) {
            console.error('Failed to edit message:', err)
        }
    }

    const fetchFollowUsers = async (userId) => {
        try {
            if (!userId) {
                console.warn('User ID not available yet')
                return
            }

            const res = await axios.get(API_ENDPOINTS.userById(userId))

            const followers = res.data.followers || []
            const following = res.data.following || []

            const combined = [...followers, ...following]
            const uniqueUsers = Array.from(new Map(combined.map((user) => [user._id, user])).values())

            setUsersList(uniqueUsers)
            setShowNewMsgModal(true)
        } catch (err) {
            console.error('Failed to fetch follow users:', err)
        }
    }

    const startConversation = async (userId) => {
        try {
            const res = await axios.post(API_ENDPOINTS.messagesStart(userId), {}, {
                headers: { Authorization: `Bearer ${token}` },
            })
            setSelectedConv(res.data)
            setConversations((prev) => {
                const exists = prev.find((c) => c._id === res.data._id)
                return exists ? prev : [res.data, ...prev]
            })
            setShowNewMsgModal(false)
        } catch (err) {
            console.error('Failed to start conversation:', err)
        }
    }

    return (
        <div className="messages-container">
            <div className="sidebar">
                <div className="sidebar-header">
                    <h2 className="sidebar-title">Direct</h2>
                    <button 
                        className="new-message-btn" 
                        onClick={() => fetchFollowUsers(currentUserId)}
                        title="New message"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                            <path d="M12.202 3.203H5.25a3 3 0 00-3 3V18a3 3 0 003 3h9.75a3 3 0 003-3V9.75a3 3 0 00-3-3h-6.75z"></path>
                            <path d="M14.25 3v4.5a1.5 1.5 0 01-1.5 1.5H9V3h5.25z"></path>
                        </svg>
                    </button>
                </div>

                <div className="conversations-header">
                    <span>Messages</span>
                    {conversations.length > 0 && (
                        <button 
                            className="new-message-button" 
                            onClick={() => fetchFollowUsers(currentUserId)}
                        >
                            ✏️
                        </button>
                    )}
                </div>

                <div className="conversations-list">
                    {conversations.map((conv) => {
                        if (!currentUserId) return null
                        const otherUser = conv.participants.find((p) => p._id !== currentUserId)
                        return (
                            <div
                                key={conv._id}
                                className={`conversation ${selectedConv?._id === conv._id ? 'active' : ''}`}
                                onClick={() => setSelectedConv(conv)}
                            >
                                <img 
                                    src={otherUser?.profilePic || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png'}
                                    alt={`${otherUser?.username} profile`}
                                    className="conversation-avatar"
                                />
                                <div className="conversation-info">
                                    <div className="conversation-name">
                                        {otherUser?.username || 'Unknown'}
                                    </div>
                                    <div className="conversation-preview">
                                        {conv.lastMessage ? conv.lastMessage.text?.slice(0, 30) + '...' : 'Start a conversation'}
                                    </div>
                                </div>
                                <div className="conversation-time">
                                    {conv.lastMessage && new Date(conv.lastMessage.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                        )
                    })}

                    {conversations.length === 0 && (
                        <div className="no-conversations">
                            <div className="no-conversations-icon">💬</div>
                            <h3>Your messages</h3>
                            <p>Send private photos and messages to a friend or group.</p>
                            <button 
                                className="send-message-btn" 
                                onClick={() => fetchFollowUsers(currentUserId)}
                            >
                                Send message
                            </button>
                        </div>
                    )}
                </div>

                {showNewMsgModal && (
                    <div className="new-message-modal">
                        <div className="modal-header">
                            <h3>New message</h3>
                            <button 
                                className="close-modal-btn"
                                onClick={() => setShowNewMsgModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="user-search">
                            <input type="text" placeholder="Search..." className="search-input" />
                        </div>
                        <div className="suggested-label">Suggested</div>
                        <div className="users-list">
                            {usersList.map((user) => (
                                <div 
                                    key={user._id} 
                                    className="user-item" 
                                    onClick={() => startConversation(user._id)}
                                >
                                    <img 
                                        src={user.profilePic || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png'}
                                        alt={`${user.username} profile`}
                                        className="user-avatar"
                                    />
                                    <div className="user-info">
                                        <div className="user-name">{user.username}</div>
                                        <div className="user-status">Active recently</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="chat-window">
                {selectedConv ? (
                    <>
                        <div className="chat-header">
                            {selectedConv.participants
                                .filter((p) => p._id !== currentUserId)
                                .map((user) => (
                                    <div 
                                        key={user._id} 
                                        className="chat-user-info"
                                        onClick={() => navigate(`/user/${user._id}`)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <img
                                            src={user.profilePic || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png'}
                                            alt={`${user.username} profile`}
                                            className="chat-user-avatar"
                                        />
                                        <div className="chat-user-details">
                                            <div className="chat-username">{user.username}</div>
                                            <div className="chat-user-status">Active recently</div>
                                        </div>
                                    </div>
                                ))}
                        </div>

                        <div className="messages-list">
                            {messages.map((msg, index) => {
                                const isOwn = msg.sender?._id === currentUserId || msg.sender === currentUserId
                                const showAvatar = !isOwn && (index === 0 || messages[index - 1]?.sender?._id !== msg.sender?._id)
                                
                                return (
                                    <div
                                        key={msg._id}
                                        className={`message ${isOwn ? 'sent' : 'received'}`}
                                    >
                                        {showAvatar && (
                                            <img 
                                                src={selectedConv.participants.find(p => p._id !== currentUserId)?.profilePic || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png'}
                                                alt="Profile"
                                                className="message-avatar"
                                            />
                                        )}
                                        
                                        <div className="message-content">
                                            {editingMessageId === msg._id ? (
                                                <div className="edit-area">
                                                    <textarea
                                                        ref={editTextareaRef}
                                                        value={editText}
                                                        onChange={(e) => {
                                                            const value = e.target.value
                                                            const numNewlines = (value.match(/\n/g) || []).length
                                                            if (value.length <= maxChars && numNewlines <= maxNewlines) {
                                                                setEditText(value)
                                                            }
                                                        }}
                                                        rows={1}
                                                        maxLength={maxChars}
                                                        placeholder="Edit your message..."
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault()
                                                                saveEdit()
                                                            }
                                                        }}
                                                        className="edit-textarea"
                                                    />
                                                    <div className="edit-actions">
                                                        <button onClick={saveEdit} className="save-btn">Save</button>
                                                        <button onClick={() => setEditingMessageId(null)} className="cancel-btn">Cancel</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="message-bubble">
                                                        <div className="message-text">
                                                            {msg.text}
                                                        </div>
                                                        {msg.edited && <div className="edited-indicator">edited</div>}
                                                    </div>
                                                    <div className="message-info">
                                                        <span className="timestamp">
                                                            {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </span>
                                                        {isOwn && (
                                                            <div className="message-actions">
                                                                <button onClick={() => startEdit(msg)} className="action-btn">Edit</button>
                                                                <button onClick={() => deleteMessage(msg._id)} className="action-btn">Delete</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="input-area">
                            <div className="input-container">
                                <textarea
                                    ref={textareaRef}
                                    value={newMessage}
                                    onChange={handleChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Message..."
                                    rows={1}
                                    className="message-textarea"
                                    maxLength={maxChars}
                                />
                                <button 
                                    onClick={sendMessage}
                                    className="send-btn"
                                    disabled={!newMessage.trim()}
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="no-conversation">
                        <div className="direct-icon">📩</div>
                        <h2>Your messages</h2>
                        <p>Send private photos and messages to a friend or group.</p>
                        <button 
                            className="send-message-btn" 
                            onClick={() => fetchFollowUsers(currentUserId)}
                        >
                            Send message
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Messages
