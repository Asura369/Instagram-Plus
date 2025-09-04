import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import './home.css'
import PostCard from './components/PostCard'
import ForYouFeed from './components/ForYouFeed'
import Modal from 'react-modal'
import { API_ENDPOINTS } from './config/api'
import { BsChevronLeft, BsChevronRight, BsDownload } from 'react-icons/bs'

const PAGE_SIZE = 5

const Home = () => {
    const [posts, setPosts] = useState([])
    const [currentUser, setCurrentUser] = useState(null)
    const [stories, setStories] = useState({})
    const [storiesProfile, setStoriesProfile] = useState([])
    const [storiesLoaded, setStoriesLoaded] = useState(false)
    const [showStorySlides, setShowStorySlides] = useState([false, null])
    const [currentStory, setCurrentStory] = useState(0)
    const [allProfiles, setStoryProfiles] = useState({})
    const [activeTab, setActiveTab] = useState('following') // New state for tab switching
    const [storiesViewed, setStoriesViewed] = useState([])

    const [cursor, setCursor] = useState(null)
    const [hasMore, setHasMore] = useState(true)
    const [loadingPosts, setLoadingPosts] = useState(false)
    const [postsError, setPostsError] = useState('')

    const sentinelRef = useRef(null)

    const postsInitRef = useRef(false)
    const postsInFlightRef = useRef(false)
    const postsAbortRef = useRef(null)
    const hasMoreRef = useRef(true)
    const cursorRef = useRef(null)
    const storyRef = useRef({})

    const storiesInitRef = useRef(false)
    const storiesProfileInitRef = useRef(false)

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

    const openStorySlides = authorId => {
        setCurrentStory(authorId)
        storyRef.current[authorId].style.border = "none"
        setShowStorySlides([true, authorId])
    }
    const closeStorySlides = () => setShowStorySlides([false, null])

    const refreshUser = async () => {
        try {
            if (!token) return
            const res = await axios.get(API_ENDPOINTS.profile, {
                headers: authHeaders
            })
            setCurrentUser(res.data)
        } catch (err) {
            console.error('Failed to refresh user data:', err)
        }
    }

    useEffect(() => {
        refreshUser()
    }, [])

    const loadPosts = async (initial = false) => {
        if (postsInFlightRef.current || !hasMoreRef.current) return

        postsInFlightRef.current = true
        setLoadingPosts(true)
        setPostsError('')

        if (postsAbortRef.current) postsAbortRef.current.abort()
        postsAbortRef.current = new AbortController()

        try {
            const res = await axios.get(API_ENDPOINTS.posts, {
                params: { limit: PAGE_SIZE, cursor: initial ? undefined : cursorRef.current },
                headers: authHeaders,
                signal: postsAbortRef.current.signal
            })

            const items = Array.isArray(res.data) ? res.data : res.data.items || []
            const next = Array.isArray(res.data) ? null : res.data.nextCursor ?? null

            setPosts(prev => {
                const seen = new Set(prev.map(p => p._id))
                const merged = [...prev]
                for (const it of items) {
                    if (!seen.has(it._id)) {
                        merged.push(it)
                        seen.add(it._id)
                    }
                }
                return merged
            })

            cursorRef.current = next
            setCursor(next)
            hasMoreRef.current = Boolean(next)
            setHasMore(Boolean(next))
        } catch (err) {
            if (err.code !== 'ERR_CANCELED') {
                console.error('Failed to load posts:', err)
                setPostsError('Failed to load posts')
            }
        } finally {
            setLoadingPosts(false)
            postsInFlightRef.current = false
        }
    }

    const updateViewedStories = async (authorId) => {
        try {
            const res = await axios.patch(API_ENDPOINTS.viewedStories, { "authorId": authorId }, {
                headers: authHeaders
            })
        } catch (err) {
            console.error('Failed to add viewed authors:', err)
        }
    }

    const resetFollowingFeed = async () => {
        if (postsAbortRef.current) postsAbortRef.current.abort()

        postsInFlightRef.current = false
        cursorRef.current = null
        hasMoreRef.current = true

        setPosts([])
        setCursor(null)
        setHasMore(true)
        setPostsError('')

        await loadPosts(true)
    }

    const didMountRef = useRef(false);
    useEffect(() => {
        if (!didMountRef.current) { didMountRef.current = true; return }
        if (activeTab === 'following') {
            resetFollowingFeed()
        }
    }, [activeTab])

    const lastFollowCountRef = useRef(null);
    useEffect(() => {
        const count = currentUser?.following?.length ?? null
        if (count == null) return

        if (lastFollowCountRef.current === null) {
            lastFollowCountRef.current = count
            return
        }

        if (activeTab === 'following' && count !== lastFollowCountRef.current) {
            lastFollowCountRef.current = count
            resetFollowingFeed()
        } else {
            lastFollowCountRef.current = count
        }
    }, [activeTab, currentUser?.following?.length])

    useEffect(() => {
        const getStoriesViewed = async () => {
            try {
                if (!token) return
                const res = await axios.get(API_ENDPOINTS.viewedStories, {
                    headers: authHeaders
                })
                setStoriesViewed(res.data.storiesViewed)
            } catch (err) {
                console.error('Failed to refresh user data:', err)
            }
        }
        getStoriesViewed()
    }, [])

    // initial page: guard StrictMode double-mount
    useEffect(() => {
        if (postsInitRef.current) return
        postsInitRef.current = true
        cursorRef.current = null
        hasMoreRef.current = true
        loadPosts(true)
        return () => {
            if (postsAbortRef.current) postsAbortRef.current.abort()
        }
    }, [])

    useEffect(() => {
        if (!sentinelRef.current) return
        const el = sentinelRef.current

        const obs = new IntersectionObserver(entries => {
            const first = entries[0]
            if (first.isIntersecting) loadPosts(false)
        }, { rootMargin: '800px 0px 800px 0px' })

        obs.observe(el)
        return () => obs.disconnect()
    }, [])

    useEffect(() => {
        const fetchStories = async () => {
            try {
                const res = await axios.get(API_ENDPOINTS.stories, {
                    headers: authHeaders
                })
                setStories(res.data)
                setStoriesLoaded(true)
            } catch (err) {
                console.error('Failed to fetch stories:', err)
            }
        }
        if (!storiesInitRef.current) {
            storiesInitRef.current = true
            fetchStories()
        }
    }, [])

    useEffect(() => {
        const fetchStoriesProfile = async () => {
            try {
                const res = await axios.get(API_ENDPOINTS.storiesUsers, {
                    headers: authHeaders
                })
                setStoriesProfile(res.data)
            } catch (err) {
                console.error('Failed to fetch stories profile:', err)
            }
        }
        if (storiesLoaded && !storiesProfileInitRef.current) {
            storiesProfileInitRef.current = true
            fetchStoriesProfile()
        }
    }, [storiesLoaded])

    useEffect(() => {
        if (storiesProfile.length > 0) {
            storiesProfile.forEach((s) => (setStoryProfiles((previousProfiles) => ({ ...previousProfiles, [s._id]: [s.profilePic, s.username] }))))
        }
    }, [storiesProfile])

    function StorySlideShow({ storyList }) {
        const allUserWithStories = Object.keys(storyList.storyList)
        const allUsersStories = storyList.storyList
        const [index, setIndex] = useState(0)
        const [authorIndex, setAuthorIndex] = useState(allUserWithStories.indexOf(storyList.authorId))
        const [progress, setProgress] = useState(0)
        const [isPlaying, setIsPlaying] = useState(true)

        const currentUser = allUserWithStories[authorIndex]
        const currentStories = allUsersStories[currentUser] || []
        const currentStoryUrl = currentStories[index]
        const userProfile = allProfiles[currentUser]

        // Auto-progress timer
        useEffect(() => {
            if (!isPlaying) return

            const timer = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        nextStory()
                        return 0
                    }
                    return prev + 2 // 5 seconds total (100/2 = 50 intervals * 100ms = 5000ms)
                })
            }, 100)

            return () => clearInterval(timer)
        }, [index, authorIndex, isPlaying])

        // Reset progress when story changes
        useEffect(() => {
            setProgress(0)
        }, [index, authorIndex])

        const previousStory = () => {
            if (!storiesViewed.includes(allUserWithStories[authorIndex])) {
                storiesViewed.push(allUserWithStories[authorIndex])
                updateViewedStories(allUserWithStories[authorIndex])
            }
            if (index === 0) {
                setIndex(0)
                if (authorIndex === 0) {
                    setAuthorIndex(allUserWithStories.length - 1)
                } else {
                    setAuthorIndex((previousAuthorIndex) => previousAuthorIndex - 1)
                }
            } else {
                setIndex((previousIndex) => (previousIndex - 1))
            }
            setProgress(0)
        }

        const nextStory = () => {
            if (!storiesViewed.includes(allUserWithStories[authorIndex])) {
                storiesViewed.push(allUserWithStories[authorIndex])
                updateViewedStories(allUserWithStories[authorIndex])
            }
            if (index === allUsersStories[allUserWithStories[authorIndex]].length - 1) {
                // Last story of current user
                if (authorIndex === allUserWithStories.length - 1) {
                    // Last user, close the story viewer
                    closeStorySlides()
                    return
                } else {
                    // Move to next user
                    setIndex(0)
                    setAuthorIndex((previousAuthorIndex) => previousAuthorIndex + 1)
                }
            } else {
                // Move to next story of same user
                setIndex((previousIndex) => (previousIndex + 1))
            }
            setProgress(0)
        }

        const handleStoryClick = (e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const clickX = e.clientX - rect.left
            const centerX = rect.width / 2

            if (clickX < centerX) {
                previousStory()
            } else {
                nextStory()
            }
        }

        const togglePlayPause = () => {
            setIsPlaying(!isPlaying)
        }

        return (
            <div className="story-viewer">
                {/* Story Progress Bars */}
                <div className="story-progress-container">
                    {currentStories.map((_, i) => (
                        <div key={i} className="story-progress-bar">
                            <div
                                className="story-progress-fill"
                                style={{
                                    width: i < index ? '100%' : i === index ? `${progress}%` : '0%'
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* Story Header */}
                <div className="story-header">
                    <div className="story-user-info">
                        <img
                            src={userProfile ? userProfile[0] : null}
                            alt="profile"
                            className="story-profile-pic"
                        />
                        <span className="story-username">
                            {userProfile ? userProfile[1] : 'Unknown User'}
                        </span>
                        <span className="story-time">2h</span>
                    </div>
                    <div className="story-actions">
                        <button
                            className="story-action-btn"
                            onClick={togglePlayPause}
                            title={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isPlaying ? '⏸️' : '▶️'}
                        </button>
                        <a
                            href={currentStoryUrl}
                            download="instagram-story"
                            target='_blank'
                            rel="noopener noreferrer"
                            className="story-action-btn"
                            title="Download"
                        >
                            <BsDownload size={20} />
                        </a>
                        <button
                            className="story-action-btn"
                            onClick={closeStorySlides}
                            title="Close"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Story Content */}
                <div className="story-content-wrapper">
                    {/* Navigation Areas */}
                    <div className="story-nav-area story-nav-left" onClick={previousStory} />
                    <div className="story-nav-area story-nav-right" onClick={nextStory} />

                    {/* Story Image/Video */}
                    <div className="story-media-container" onClick={handleStoryClick}>
                        <img
                            src={currentStoryUrl}
                            alt='Story'
                            className="story-media"
                            onLoad={() => setProgress(0)}
                        />
                    </div>

                    {/* Navigation Arrows */}
                    {allUserWithStories.length > 1 && (
                        <>
                            <button
                                className="story-nav-arrow story-nav-arrow-left"
                                onClick={previousStory}
                                title="Previous story"
                            >
                                <BsChevronLeft size={24} />
                            </button>
                            <button
                                className="story-nav-arrow story-nav-arrow-right"
                                onClick={nextStory}
                                title="Next story"
                            >
                                <BsChevronRight size={24} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className='feed-container'>
            <Modal
                isOpen={(showStorySlides[0])}
                onRequestClose={closeStorySlides}
                className="story-modal"
                overlayClassName="story-modal-overlay"
                shouldCloseOnOverlayClick={true}
                shouldCloseOnEsc={true}
            >
                {currentStory && (
                    <StorySlideShow storyList={{ "storyList": stories, "authorId": showStorySlides[1] }} />
                )}
            </Modal>

            {/* Stories Section */}
            {storiesProfile.length === 0 ? (
                <p>No stories yet</p>
            ) : (
                <div className="stories-strip">
                    {storiesProfile.map(s => (
                        <div key={s._id} className="story">
                            <a
                                onClick={e => {
                                    e.preventDefault()
                                    openStorySlides(s._id)
                                    updateViewedStories(s._id)
                                }}
                            >
                                <div className="story-thumb">
                                    <img
                                        src={s.profilePic}
                                        alt="Story"
                                        className="story-image"
                                        style={{
                                            border: storiesViewed.includes(s._id)
                                                ? '2px solid #c7c7c7'
                                                : '2px solid #e1306c'
                                        }}
                                        ref={el => { storyRef.current[s._id] = el }}
                                    />
                                </div>
                            </a>
                            <p>{s.username}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Tab Navigation */}
            <div className="feed-tabs" style={{
                display: 'flex',
                borderBottom: '1px solid #dbdbdb',
                marginBottom: '16px',
                position: 'sticky',
                top: '-20px',
                backgroundColor: 'white',
                zIndex: 1000,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <button
                    onClick={() => setActiveTab('following')}
                    style={{
                        flex: 1,
                        padding: '12px',
                        border: 'none',
                        background: 'none',
                        fontSize: '14px',
                        fontWeight: activeTab === 'following' ? '600' : '400',
                        color: activeTab === 'following' ? '#262626' : '#8e8e8e',
                        borderBottom: activeTab === 'following' ? '2px solid #262626' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >
                    Following
                </button>
                <button
                    onClick={() => setActiveTab('foryou')}
                    style={{
                        flex: 1,
                        padding: '12px',
                        border: 'none',
                        background: 'none',
                        fontSize: '14px',
                        fontWeight: activeTab === 'foryou' ? '600' : '400',
                        color: activeTab === 'foryou' ? '#262626' : '#8e8e8e',
                        borderBottom: activeTab === 'foryou' ? '2px solid #262626' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >
                    For You
                </button>
            </div>

            {/* Feed Content */}
            {activeTab === 'following' ? (
                <div className="following-feed">
                    {posts.length === 0 && !loadingPosts && !postsError && (
                        <div style={{
                            textAlign: 'center',
                            padding: '32px 16px',
                            color: '#8e8e8e',
                            fontSize: '14px'
                        }}>
                            <p>No posts from people you follow yet</p>
                            <p>Follow some users or check out the "For You" section!</p>
                        </div>
                    )}

                    {posts.map(p => (
                        <PostCard
                            key={p._id}
                            post={p}
                            token={token}
                            currentUserId={currentUser?._id}
                            currentUser={currentUser}
                            onFollowChange={refreshUser}
                        />
                    ))}

                    {postsError && <div style={{ color: 'crimson', padding: 12 }}>{postsError}</div>}
                    {loadingPosts && <div style={{ padding: 12 }}>Loading…</div>}
                    {!hasMore && posts.length > 0 && <div style={{ padding: 12, color: '#777' }}>You're all caught up</div>}

                    {/* sentinel for infinite scroll */}
                    <div ref={sentinelRef} style={{ height: 1 }} />
                </div>
            ) : (
                <ForYouFeed
                    currentUser={currentUser}
                    token={token}
                    onFollowChange={refreshUser}
                />
            )}
        </div>
    )
}

export default Home
