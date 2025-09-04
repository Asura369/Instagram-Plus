import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_ENDPOINTS } from '../config/api'
import './Create.css'

const MAX_MEDIA = 5

const Spinner = () => (
    <div className="loading-spinner">
        <svg viewBox='0 0 50 50' style={{ width: '100%', height: '100%' }} aria-label='Loading'>
            <circle cx='25' cy='25' r='20' stroke='#fff' strokeWidth='5' fill='none' opacity='0.2' />
            <path fill='none' stroke='#fff' strokeWidth='5' d='M25 5 a20 20 0 0 1 0 40'>
                <animateTransform attributeName='transform' type='rotate' from='0 25 25' to='360 25 25' dur='1s' repeatCount='indefinite' />
            </path>
        </svg>
    </div>
)

const CreatePost = () => {
    const [caption, setCaption] = useState('')
    const [media, setMedia] = useState([])
    const [status, setStatus] = useState('')
    const [current, setCurrent] = useState(0)
    const [isUploading, setIsUploading] = useState(false)

    const pasteZoneRef = useRef(null)
    const fileInputRef = useRef(null)
    const navigate = useNavigate()

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const headers = { Authorization: `Bearer ${token}` }

    const newUploadsRef = useRef(new Set())
    const submittedRef = useRef(false)

    const addWithRoom = files => {
        const room = MAX_MEDIA - media.length
        if (room <= 0) return []
        return files.slice(0, room)
    }

    const uploadFiles = async files => {
        const fd = new FormData()
        files.forEach(f => fd.append('files', f))
        const res = await axios.post(API_ENDPOINTS.uploadMedia, fd, {
            headers: { ...headers, 'Content-Type': 'multipart/form-data' }
        })
        return res.data?.media || []
    }

    const deleteByPublicIds = async publicIds => {
        if (!publicIds?.length) return
        try {
            await axios.delete(API_ENDPOINTS.uploadMedia, {
                headers,
                data: { publicIds }
            })
        } catch (e) {
            console.error('Cloud delete failed', e)
        }
    }

    const handleFileChange = async e => {
        if (isUploading) {
            setStatus('An upload is in progress — please wait…')
            return
        }

        const files = Array.from(e.target.files || [])
        if (!files.length) return

        const list = addWithRoom(files)
        if (!list.length) {
            setStatus(`You can upload up to ${MAX_MEDIA} items`)
            return
        }

        const startIndex = media.length
        const placeholders = list.map(f => ({
            kind: f.type.startsWith('video/') ? 'video' : 'image',
            src: '',
            uploading: true,
            name: f.name || ''
        }))

        setMedia(prev => {
            const updated = [...prev, ...placeholders]
            setCurrent(updated.length - 1)
            return updated
        })

        setIsUploading(true)
        setStatus('Uploading…')

        try {
            const uploaded = await uploadFiles(list) // [{kind, src, publicId, ...}]
            uploaded.forEach(u => {
                if (u.publicId) newUploadsRef.current.add(u.publicId)
            })
            setMedia(prev => {
                const copy = [...prev]
                for (let i = 0; i < uploaded.length; i++) {
                    const at = startIndex + i
                    if (copy[at]) copy[at] = { ...uploaded[i], uploading: false, name: list[i]?.name || '' }
                }
                return copy
            })
            setStatus('Ready to post')
        } catch (err) {
            console.error(err)
            setMedia(prev => prev.filter((_, i) => i < startIndex || i >= startIndex + placeholders.length))
            setCurrent(prev => Math.max(0, Math.min(prev, startIndex - 1)))
            setStatus('Upload failed')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handlePaste = async e => {
        if (isUploading) {
            setStatus('An upload is in progress — please wait before pasting')
            return
        }

        const filesFromClipboard = []
        const dtFiles = Array.from(e.clipboardData?.files || [])
        for (const f of dtFiles) {
            if (f.type.startsWith('image/') || f.type.startsWith('video/')) {
                filesFromClipboard.push(f)
            }
        }

        if (!filesFromClipboard.length) return
        e.preventDefault()

        const list = addWithRoom(filesFromClipboard)
        if (!list.length) {
            setStatus(`You can upload up to ${MAX_MEDIA} items`)
            return
        }

        const startIndex = media.length
        const placeholders = list.map(f => ({
            kind: f.type.startsWith('video/') ? 'video' : 'image',
            src: '',
            uploading: true,
            name: f.name || ''
        }))

        setMedia(prev => {
            const updated = [...prev, ...placeholders]
            setCurrent(updated.length - 1)
            return updated
        })

        setIsUploading(true)
        setStatus('Uploading…')

        try {
            const uploaded = await uploadFiles(list)
            uploaded.forEach(u => {
                if (u.publicId) newUploadsRef.current.add(u.publicId)
            })
            setMedia(prev => {
                const copy = [...prev]
                for (let i = 0; i < uploaded.length; i++) {
                    const at = startIndex + i
                    if (copy[at]) copy[at] = { ...uploaded[i], uploading: false, name: list[i]?.name || '' }
                }
                return copy
            })
            setStatus('Ready to post')
        } catch (err) {
            console.error(err)
            setMedia(prev => prev.filter((_, i) => i < startIndex || i >= startIndex + placeholders.length))
            setCurrent(prev => Math.max(0, Math.min(prev, startIndex - 1)))
            setStatus('Upload failed')
        } finally {
            setIsUploading(false)
        }
    }

    useEffect(() => {
        const onWindowPaste = async e => {
            const tag = document.activeElement?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA') return
            await handlePaste(e)
        }
        window.addEventListener('paste', onWindowPaste)
        return () => window.removeEventListener('paste', onWindowPaste)
    }, [isUploading, media.length])

    const removeAt = async idx => {
        const item = media[idx]
        if (item?.uploading) return

        if (item?.publicId) {
            if (newUploadsRef.current.has(item.publicId)) {
                await deleteByPublicIds([item.publicId])
                newUploadsRef.current.delete(item.publicId)
            }
        }

        const updated = media.filter((_, i) => i !== idx)
        setMedia(updated)
        if (updated.length === 0) setCurrent(0)
        else setCurrent(Math.min(idx, updated.length - 1))
    }

    const handleSubmit = async e => {
        e.preventDefault()
        if (isUploading) {
            setStatus('Please wait for uploads to finish')
            return
        }
        if (media.length === 0) {
            setStatus('Add at least one image or video')
            return
        }

        try {
            await axios.post(API_ENDPOINTS.posts, { caption, media }, { headers })

            submittedRef.current = true
            newUploadsRef.current.clear()

            alert('Post created')
            navigate('/')
        } catch (err) {
            console.error(err)
            setStatus(err.response?.data?.message || 'Failed to create post')
        }
    }

    useEffect(() => {
        return () => {
            if (!submittedRef.current) {
                const ids = Array.from(newUploadsRef.current)
                if (ids.length) {
                    axios.delete(API_ENDPOINTS.uploadMedia, {
                        headers,
                        data: { publicIds: ids }
                    }).catch(() => { })
                    newUploadsRef.current.clear()
                }
            }
        }
    }, [])

    const cur = media[current]

    return (
        <div className="create-post-container">
            <div className="create-post-card">
                <h2 className="create-post-title">Create New Post</h2>

                <div
                    ref={pasteZoneRef}
                    onPaste={handlePaste}
                    tabIndex={isUploading ? -1 : 0}
                    className={`paste-zone ${isUploading ? 'uploading' : ''}`}
                    role='button'
                    aria-label={isUploading ? 'Uploading, paste disabled' : 'Paste media here'}
                >
                    {isUploading
                        ? 'Uploading… please wait'
                        : 'Press Ctrl/Cmd+V to paste an image/video, or use the file selector below'}
                </div>

                <form onSubmit={handleSubmit}>
                    <input
                        ref={fileInputRef}
                        type='file'
                        accept='image/*,video/*'
                        multiple
                        onChange={handleFileChange}
                        disabled={isUploading}
                        className="file-input"
                    />

                    {media.length > 0 && (
                        <div>
                            <div className="media-controls">
                                {current > 0 && (
                                    <button 
                                        type='button' 
                                        className="media-nav-btn"
                                        onClick={() => setCurrent(c => Math.max(0, c - 1))}
                                    >
                                        ‹
                                    </button>
                                )}
                                <div className="media-counter">{current + 1} / {media.length}</div>
                                {current < media.length - 1 && (
                                    <button 
                                        type='button' 
                                        className="media-nav-btn"
                                        onClick={() => setCurrent(c => Math.min(media.length - 1, c + 1))}
                                    >
                                        ›
                                    </button>
                                )}
                                <button 
                                    type='button' 
                                    className="remove-btn"
                                    onClick={() => removeAt(current)} 
                                    disabled={media[current]?.uploading}
                                >
                                    Remove
                                </button>
                            </div>

                            <div className="media-preview">
                                {cur?.uploading ? (
                                    <div className="loading-container">
                                        <Spinner />
                                        <div className="loading-text">Uploading media...</div>
                                    </div>
                                ) : cur?.kind === 'video' ? (
                                    <video src={cur.src} controls />
                                ) : (
                                    <img src={cur?.src} alt='preview' />
                                )}
                            </div>

                            <div className="thumbnail-container">
                                {media.map((m, i) => (
                                    <div
                                        key={m.publicId || `ph-${i}`}
                                        onClick={() => setCurrent(i)}
                                        className={`thumbnail ${i === current ? 'active' : 'inactive'} ${m.uploading ? 'uploading' : ''}`}
                                        title={m.kind === 'video' ? (m.name || 'video') : undefined}
                                    >
                                        {m.kind === 'video'
                                            ? (
                                                <div className="thumbnail-video">
                                                    <span>
                                                        {m.uploading ? 'Uploading…' : (m.name || 'video')}
                                                    </span>
                                                </div>
                                            )
                                            : (
                                                m.uploading
                                                    ? <div className="thumbnail-video">
                                                        <span>Uploading…</span>
                                                      </div>
                                                    : <img src={m.src} alt={`thumb-${i}`} />
                                            )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <textarea
                        placeholder='Write a caption…'
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        rows={3}
                        className="caption-textarea"
                    />

                    <button 
                        type='submit' 
                        className="post-btn"
                        disabled={isUploading}
                    >
                        {isUploading ? 'Processing…' : 'Post'}
                    </button>
                </form>

                {status && <div className="status-message">{status}</div>}
            </div>
        </div>
    )
}

export default CreatePost
