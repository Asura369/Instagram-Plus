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
            const res = await axios.patch(API_ENDPOINTS.viewedStories, {"authorId": authorId}, {
                headers: authHeaders
            })
        } catch (err) {
            console.error('Failed to add viewed authors:', err)
        }
    }

    useEffect(() => {
        const getStoriesViewed = async () => {
            try {
                if (!token) return
                const res = await axios.get(API_ENDPOINTS.viewedStories, {
                    headers: authHeaders
                })
                setStoriesViewed(res.data.storiesViewed);
            } catch (err) {
                console.error('Failed to refresh user data:', err)
            }
        }
        getStoriesViewed();
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
        if(storiesProfile.length > 0) {
            storiesProfile.forEach((s) => (setStoryProfiles((previousProfiles) => ({...previousProfiles, [s._id]: [s.profilePic, s.username]}))));
        }
    }, [storiesProfile])

    function StorySlideShow({storyList}) {
        const allUserWithStories = Object.keys(storyList.storyList);
        const allUsersStories = storyList.storyList;
        const [index, setIndex] = useState(0);
        const [authorIndex, setAuthorIndex] = useState(allUserWithStories.indexOf(storyList.authorId));

        const previousStory = () => {
            if (!storiesViewed.includes(allUserWithStories[authorIndex])) {
                storiesViewed.push(allUserWithStories[authorIndex]);
                updateViewedStories(allUserWithStories[authorIndex]);
            }
            if (index === 0) {
                setIndex(0);
                if (authorIndex === 0) {
                    setAuthorIndex(allUserWithStories.length - 1);
                } else {
                    setAuthorIndex((previousAuthorIndex) => previousAuthorIndex - 1);
                }
            } else {
                setIndex((previousIndex) => (previousIndex - 1));
            }
        }
        const nextStory = () => {
            if (!storiesViewed.includes(allUserWithStories[authorIndex])) {
                storiesViewed.push(allUserWithStories[authorIndex]);
                updateViewedStories(allUserWithStories[authorIndex]);
            }
            if (index === allUsersStories[allUserWithStories[authorIndex]].length - 1) {
                setIndex(0);
                if (authorIndex === allUserWithStories.length - 1) {
                    setAuthorIndex(0);
                } else {
                    setAuthorIndex((previousAuthorIndex) => previousAuthorIndex + 1);
                }
            } else {
                setIndex((previousIndex) => (previousIndex + 1));
            }
        }

        return (
            <div style={{display: "block"}}>
                <img 
                    key={allProfiles[allUserWithStories[authorIndex]] ? allProfiles[allUserWithStories[authorIndex]][0] + authorIndex : null}
                    src={allProfiles[allUserWithStories[authorIndex]] ? allProfiles[allUserWithStories[authorIndex]][0] : null}
                    alt="profile"
                    style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover'}}
                />
                <p>{allProfiles[allUserWithStories[authorIndex]] ? allProfiles[allUserWithStories[authorIndex]][1] : null}</p>
                <a
                    href={allUsersStories[allUserWithStories[authorIndex]][index]}
                    download="instagram-image"
                    target='_blank'
                    rel="noopener noreferrer"
                    style={{
                        background: "none", border: "none"
                    }}>
                        <BsDownload size={24}/>
                </a>
                <div className='slide-display'>
                   {(allUserWithStories.length > 1) ? <button onClick={previousStory} 
                        style={{
                            background: "none", border: "none"
                        }}>
                        <BsChevronLeft size={24}/>
                    </button> : <></>}
                    <img
                        key={currentStory + index}
                        src={allUsersStories[allUserWithStories[authorIndex]] ? allUsersStories[allUserWithStories[authorIndex]][index] : null}
                        alt='Story'
                        style={{ width: "500px", height: "500px" }}
                    />
                    {(allUserWithStories.length > 1) ? <button onClick={nextStory} 
                        style={{
                            background: "none", border: "none"
                        }}>
                        <BsChevronRight size={24}/>
                    </button> : <></>}
                </div>
            </div>
        )
    }

    return (
        <div className='feed-container'>
            <Modal isOpen={(showStorySlides[0])} onRequestClose={closeStorySlides} style={
                    {content: {
                        display: "flex",
                        justifyContent: "center",
                        textAlign: "center",
                        alignContent: "center",
                        width: "50%", 
                        height: "100%",
                        inset: "unset"
                    },
                    overlay: {
                        display: "flex",
                        backgroundColor: "rgba(0, 0, 0, 0.6)",
                        textAlign: "center",
                        justifyContent: "center",
                        alignContent: "center",
                        height: "100%",
                        position: "fixed"
                    },

                }
                }>
                {currentStory && (
                    <div className='story-content'>
                        <StorySlideShow storyList={{"storyList": stories, "authorId": showStorySlides[1]}}/>
                    </div>
                )}
            </Modal>

            {/* Stories Section */}
            {storiesProfile.length === 0 ? (
                <p>No stories yet</p>
            ) : (
                <div style={{ display: 'flex', gap: 10, padding: '10px 6px', overflowX: 'auto', marginBottom: 16 }}>
                    {storiesProfile.map(s => (
                        <div key={s._id}>
                            <a onClick={e => {
                                e.preventDefault()
                                openStorySlides(s._id)
                                updateViewedStories(s._id)
                            }}>
                                <div className='story' style={{ flex: '0 0 auto' }}>
                                    <img
                                        src={s.profilePic}
                                        alt='Story'
                                        className='story-image'
                                        style={{ width: 72, 
                                            height: 72, 
                                            borderRadius: '50%', 
                                            objectFit: 'cover', 
                                            border: storiesViewed.includes(s._id) ? "none" : '2px solid #e1306c' }}
                                        ref={(element) => {
                                            storyRef.current[s._id] = element
                                        }}
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
                top: '0',
                backgroundColor: 'white',
                zIndex: 10
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
