import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_ENDPOINTS } from '../config/api'
import './Stories.css'

const Spinner = () => (
    <div className="stories-loading-spinner">
        <svg viewBox='0 0 50 50' style={{ width: '100%', height: '100%' }} aria-label='Loading'>
            <circle cx='25' cy='25' r='20' stroke='#fff' strokeWidth='5' fill='none' opacity='0.2' />
            <path fill='none' stroke='#fff' strokeWidth='5' d='M25 5 a20 20 0 0 1 0 40'>
                <animateTransform attributeName='transform' type='rotate' from='0 25 25' to='360 25 25' dur='1s' repeatCount='indefinite' />
            </path>
        </svg>
    </div>
)

function Stories() {
    const [media, setMedia] = useState(null)
    const [status, setStatus] = useState('')
    const [uploading, setUploading] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    const fileInputRef = useRef(null)
    const pasteZoneRef = useRef(null)
    const newUploadPidRef = useRef(null)
    const navigate = useNavigate()
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const headers = { Authorization: `Bearer ${token}` }

    const uploadOne = async file => {
        const fd = new FormData()
        fd.append('files', file)
        const res = await axios.post(API_ENDPOINTS.uploadMedia, fd, {
            headers: { ...headers, 'Content-Type': 'multipart/form-data' }
        })
        const first = (res.data?.media || [])[0]
        return first
    }

    const deleteByPublicId = async pid => {
        if (!pid) return
        try {
            await axios.delete(API_ENDPOINTS.uploadMedia, {
                headers,
                data: { publicIds: [pid] }
            })
        } catch (e) {
            console.error('cloud delete failed', e)
        }
    }

    const setPlaceholderThenUpload = async file => {
        if (newUploadPidRef.current) {
            await deleteByPublicId(newUploadPidRef.current)
            newUploadPidRef.current = null
        }

        setMedia({ kind: file.type.startsWith('video/') ? 'video' : 'image', src: '', uploading: true })
        setUploading(true)
        setStatus('Uploading…')

        try {
            const uploaded = await uploadOne(file) // { kind, src, publicId, ... }
            if (!uploaded) throw new Error('no upload response')

            newUploadPidRef.current = uploaded.publicId || null
            setMedia({ ...uploaded, uploading: false })
            setStatus('Ready to post')
        } catch (err) {
            console.error(err)
            setMedia(null)
            setStatus('Upload failed')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleStoryChange = async e => {
        if (uploading) {
            setStatus('An upload is in progress — please wait…')
            return
        }
        const file = e.target.files?.[0]
        if (!file) return
        await setPlaceholderThenUpload(file)
    }

    const handlePaste = async e => {
        if (uploading) {
            setStatus('An upload is in progress — please wait before pasting')
            return
        }

        const files = Array.from(e.clipboardData?.files || [])
        const file = files.find(f => f.type.startsWith('image/') || f.type.startsWith('video/'))

        if (!file) return
        e.preventDefault()
        await setPlaceholderThenUpload(file)
    }

    useEffect(() => {
        const onWindowPaste = async e => {
            const tag = document.activeElement?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA') return
            await handlePaste(e)
        }
        window.addEventListener('paste', onWindowPaste)
        return () => window.removeEventListener('paste', onWindowPaste)
    }, [uploading])

    const handleSubmit = async e => {
        e.preventDefault()
        if (!media || media.uploading) {
            setStatus('Please add an image or video first')
            return
        }
        try {
            await axios.post(API_ENDPOINTS.stories, { media }, { headers })
            setSubmitted(true)
            newUploadPidRef.current = null
            alert('Story created!')
            navigate('/')
        } catch (err) {
            console.error(err)
            setStatus(err.response?.data?.message || 'Failed to create story')
        }
    }

    const clearMedia = async () => {
        if (uploading) return
        if (newUploadPidRef.current) {
            await deleteByPublicId(newUploadPidRef.current)
            newUploadPidRef.current = null
        }
        setMedia(null)
        setStatus('')
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    // cleanup unsaved uploaded asset if user leaves
    useEffect(() => {
        const beforeUnload = () => {
            if (submitted) return
            if (newUploadPidRef.current) {
                navigator.sendBeacon?.(
                    API_ENDPOINTS.uploadMedia,
                    new Blob([JSON.stringify({ publicIds: [newUploadPidRef.current] })], { type: 'application/json' })
                )
            }
        }
        window.addEventListener('beforeunload', beforeUnload)
        return () => {
            window.removeEventListener('beforeunload', beforeUnload)
            if (!submitted && newUploadPidRef.current) {
                deleteByPublicId(newUploadPidRef.current)
                newUploadPidRef.current = null
            }
        }
    }, [submitted])

    return (
        <div className="stories-container">
            <div className="stories-card">
                <h1 className="stories-title">Create New Story</h1>

                <div
                    ref={pasteZoneRef}
                    onPaste={handlePaste}
                    tabIndex={uploading ? -1 : 0}
                    className={`stories-paste-zone ${uploading ? 'uploading' : ''}`}
                    role='button'
                    aria-label={uploading ? 'Uploading, paste disabled' : 'Paste image/video here'}
                >
                    {uploading
                        ? 'Uploading… please wait'
                        : 'Press Ctrl/Cmd+V to paste an image/video, or use the file selector below'}
                </div>

                <form onSubmit={handleSubmit}>
                    <input
                        ref={fileInputRef}
                        type='file'
                        accept='image/*,video/*'
                        onChange={handleStoryChange}
                        disabled={uploading}
                        className="stories-file-input"
                        required={!media}
                    />

                    {media && (
                        <div className="stories-media-preview">
                            {media.uploading ? (
                                <div className="stories-loading-container">
                                    <Spinner />
                                    <div className="stories-loading-text">Uploading media...</div>
                                </div>
                            ) : media.kind === 'video' ? (
                                <video src={media.src} controls />
                            ) : (
                                <img src={media.src} alt='preview' />
                            )}
                        </div>
                    )}

                    <div className="stories-button-container">
                        <button 
                            type='submit' 
                            className="stories-post-btn"
                            disabled={uploading || !media || media.uploading}
                        >
                            {uploading ? 'Uploading…' : 'Post Story'}
                        </button>
                        {media && (
                            <button 
                                type='button' 
                                className="stories-remove-btn"
                                onClick={clearMedia} 
                                disabled={uploading}
                            >
                                Remove
                            </button>
                        )}
                    </div>
                </form>

                {status && <div className="stories-status-message">{status}</div>}
            </div>
        </div>
    )
}

export default Stories
