// API configuration based on environment
const isDevelopment = import.meta.env.MODE === 'development' ||
    import.meta.env.DEV ||
    window.location.hostname === 'localhost';

export const API_BASE_URL = isDevelopment
    ? 'http://localhost:5000'
    : 'https://instaplus.up.railway.app';

// Helper function to create full API URLs
export const createApiUrl = (endpoint) => {
    // Remove leading slash if present to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Common API endpoints
export const API_ENDPOINTS = {
    // Auth endpoints
    login: createApiUrl('auth/login'),
    register: createApiUrl('auth/register'),

    // User endpoints
    profile: createApiUrl('users/profile'),
    editProfile: createApiUrl('users/editProfile'),
    users: createApiUrl('users'),
    viewedStories: createApiUrl("users/viewedStories"),
    userById: (id) => createApiUrl(`users/${id}`),
    follow: (id) => createApiUrl(`users/${id}/follow`),
    searchUsers: (query) => createApiUrl(`users/search/${encodeURIComponent(query)}`),

    // Post endpoints
    posts: createApiUrl('posts'),
    forYouPosts: createApiUrl('posts/foryou'),
    postById: (id) => createApiUrl(`posts/${id}`),
    userPosts: (userId) => createApiUrl(`posts/user/${userId}`),
    likePost: (id) => createApiUrl(`posts/${id}/like`),
    postComments: (id) => createApiUrl(`posts/${id}/comments`),
    editPost: (id) => createApiUrl(`posts/${id}`),
    deletePost: (id) => createApiUrl(`posts/${id}`),
    commentById: (postId, commentId) => createApiUrl(`posts/${postId}/comments/${commentId}`),
    likeComment: (postId, commentId) => createApiUrl(`posts/${postId}/comments/${commentId}/like`),

    // Story endpoints
    stories: createApiUrl('stories'),
    storiesUsers: createApiUrl('stories/users'),

    // Upload endpoints
    uploadMedia: createApiUrl('upload/media'),
    uploadVideo: createApiUrl('upload/video'),
    generateStory: createApiUrl('upload/generate-story'),

    // Messages endpoints
    messagesConversations: createApiUrl('messages/conversations'),
    messagesById: (id) => createApiUrl(`messages/${id}`),
    messagesStart: (userId) => createApiUrl(`messages/start/${userId}`),
    deleteMessage: (messageId) => createApiUrl(`messages/${messageId}`),
    editMessage: (messageId) => createApiUrl(`messages/${messageId}`)
};

export default API_BASE_URL;
