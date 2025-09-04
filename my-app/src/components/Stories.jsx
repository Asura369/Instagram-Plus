import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_ENDPOINTS } from '../config/api'
import { FaUpload, FaMagic, FaImage, FaUser } from 'react-icons/fa'
import './Stories.css'

const Spinner = () => (
    <div style={{
        width: 64,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto'
    }}>
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
    
    // AI Generation states
    const [showAiGenerator, setShowAiGenerator] = useState(false)
    const [userPhoto, setUserPhoto] = useState(null)
    const [selectedTheme, setSelectedTheme] = useState('')
    const [generatedImage, setGeneratedImage] = useState(null)
    const [isGenerating, setIsGenerating] = useState(false)

    const fileInputRef = useRef(null)
    const userPhotoInputRef = useRef(null)
    const pasteZoneRef = useRef(null)
    const newUploadPidRef = useRef(null)
    const navigate = useNavigate()
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const headers = { Authorization: `Bearer ${token}` }

    // Theme options for AI generation
    const themes = [
        { id: 'beach', name: 'Beach', emoji: '🏖️', description: 'Tropical beach paradise' },
        { id: 'mountains', name: 'Mountains', emoji: '🏔️', description: 'Majestic mountain landscape' },
        { id: 'city', name: 'City', emoji: '🏙️', description: 'Urban cityscape' },
        { id: 'forest', name: 'Forest', emoji: '🌲', description: 'Lush green forest' },
        { id: 'desert', name: 'Desert', emoji: '🏜️', description: 'Golden desert dunes' },
        { id: 'sunset', name: 'Sunset', emoji: '🌅', description: 'Beautiful sunset sky' },
        { id: 'space', name: 'Space', emoji: '🌌', description: 'Cosmic starry background' },
        { id: 'underwater', name: 'Underwater', emoji: '🌊', description: 'Deep ocean scene' },
    ]

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

    // AI Generation Functions
    const handleUserPhotoUpload = async e => {
        const file = e.target.files?.[0]
        if (!file) return
        
        if (!file.type.startsWith('image/')) {
            setStatus('Please select an image file for your photo')
            return
        }

        // Create preview for user photo
        const reader = new FileReader()
        reader.onload = e => {
            setUserPhoto({
                file,
                preview: e.target.result
            })
        }
        reader.readAsDataURL(file)
        setStatus('User photo selected')
    }

    const generateAiImage = async () => {
        if (!userPhoto || !selectedTheme) {
            setStatus('Please select both a user photo and theme')
            return
        }

        setIsGenerating(true)
        setStatus('Generating AI image...')

        try {
            // Create FormData with user photo and theme
            const formData = new FormData()
            formData.append('userPhoto', userPhoto.file)
            formData.append('theme', selectedTheme)
            formData.append('prompt', `Place the person in a beautiful ${themes.find(t => t.id === selectedTheme)?.description} setting, photorealistic, high quality`)

            // Call AI generation API (you'll need to implement this endpoint)
            const response = await axios.post(API_ENDPOINTS.generateStoryImage || '/api/generate-story', formData, {
                headers: { 
                    ...headers, 
                    'Content-Type': 'multipart/form-data' 
                }
            })

            if (response.data?.success) {
                const aiData = response.data;
                setGeneratedImage({
                    src: aiData.imageUrl, // Cloudinary URL
                    kind: 'image',
                    publicId: aiData.publicId, // Cloudinary publicId
                    aiGenerated: aiData.aiGenerated || true,
                    aiMetadata: aiData.media?.aiMetadata || {
                        theme: aiData.theme,
                        model: aiData.model,
                        enhancedWithGemini: aiData.enhancedWithGemini
                    }
                })
                setStatus(`AI image generated successfully!`)
            } else {
                throw new Error('No image returned from AI service')
            }
        } catch (error) {
            console.error('AI generation failed:', error)
            
            // Fallback: Create a mock generated image for demo purposes
            setGeneratedImage({
                src: userPhoto.preview, // Use user photo as fallback
                kind: 'image',
                publicId: null,
                isMockGenerated: true
            })
            setStatus(`Mock AI generation complete (Theme: ${themes.find(t => t.id === selectedTheme)?.name})`)
        } finally {
            setIsGenerating(false)
        }
    }

    const useGeneratedImage = () => {
        if (!generatedImage) return
        
        // Use the AI generated image with Cloudinary URL and publicId
        const mediaForStory = {
            ...generatedImage,
            src: generatedImage.src // Direct Cloudinary URL
        }
        
        setMedia(mediaForStory)
        setShowAiGenerator(false)
        setStatus('AI generated image ready to post')
    }

    const clearAiGeneration = () => {
        setUserPhoto(null)
        setSelectedTheme('')
        setGeneratedImage(null)
        setStatus('')
        if (userPhotoInputRef.current) userPhotoInputRef.current.value = ''
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
        // Also clear AI generation state when clearing media
        setShowAiGenerator(false)
        clearAiGeneration()
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
        <div style={{ maxWidth: 560, margin: '0 auto', padding: 20 }}>
            <h1>Create New Story</h1>

            <div
                ref={pasteZoneRef}
                onPaste={handlePaste}
                tabIndex={uploading ? -1 : 0}
                style={{
                    border: '2px dashed #ccc',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 12,
                    outline: 'none',
                    opacity: uploading ? 0.6 : 1,
                    pointerEvents: uploading ? 'none' : 'auto',
                    userSelect: 'none'
                }}
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
                    style={{ display: 'block', marginBottom: 10, opacity: uploading ? 0.6 : 1 }}
                    required={!media}
                />

                {/* AI Generation Toggle Button */}
                <div style={{ marginBottom: 20, textAlign: 'center' }}>
                    <button
                        type="button"
                        onClick={() => setShowAiGenerator(!showAiGenerator)}
                        className="ai-toggle-btn"
                        style={{
                            background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '25px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            margin: '0 auto',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'transform 0.2s ease'
                        }}
                        onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                    >
                        <FaMagic />
                        {showAiGenerator ? 'Hide AI Generator' : 'Create with AI'}
                    </button>
                </div>

                {/* AI Generation UI */}
                {showAiGenerator && (
                    <div className="ai-generator-container" style={{
                        border: '2px solid #667eea',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '20px',
                        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
                    }}>
                        <h3 style={{ 
                            margin: '0 0 16px 0', 
                            color: '#333',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <FaMagic style={{ color: '#667eea' }} />
                            AI Story Generator
                        </h3>

                        {/* User Photo Upload */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ 
                                display: 'block', 
                                marginBottom: '8px', 
                                fontWeight: '600',
                                color: '#555',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <FaUser />
                                Upload Your Photo:
                            </label>
                            <input
                                ref={userPhotoInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleUserPhotoUpload}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    backgroundColor: 'white'
                                }}
                            />
                            {userPhoto && (
                                <div style={{ marginTop: '8px' }}>
                                    <img 
                                        src={userPhoto.preview} 
                                        alt="User preview" 
                                        style={{ 
                                            width: '80px', 
                                            height: '80px', 
                                            objectFit: 'cover', 
                                            borderRadius: '8px',
                                            border: '2px solid #667eea'
                                        }} 
                                    />
                                </div>
                            )}
                        </div>

                        {/* Theme Selection */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ 
                                display: 'block', 
                                marginBottom: '12px', 
                                fontWeight: '600',
                                color: '#555'
                            }}>
                                Choose Background Theme:
                            </label>
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                                gap: '8px' 
                            }}>
                                {themes.map(theme => (
                                    <button
                                        key={theme.id}
                                        type="button"
                                        onClick={() => setSelectedTheme(theme.id)}
                                        style={{
                                            padding: '12px 8px',
                                            border: selectedTheme === theme.id ? '2px solid #667eea' : '1px solid #ddd',
                                            borderRadius: '8px',
                                            background: selectedTheme === theme.id ? 'white' : '#f8f9fa',
                                            cursor: 'pointer',
                                            textAlign: 'center',
                                            fontSize: '12px',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ fontSize: '20px', marginBottom: '4px' }}>
                                            {theme.emoji}
                                        </div>
                                        <div style={{ fontWeight: '600', color: '#333' }}>
                                            {theme.name}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Generate Button */}
                        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                            <button
                                type="button"
                                onClick={generateAiImage}
                                disabled={!userPhoto || !selectedTheme || isGenerating}
                                style={{
                                    background: (!userPhoto || !selectedTheme) ? '#ccc' : 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '12px 24px',
                                    borderRadius: '25px',
                                    cursor: (!userPhoto || !selectedTheme) ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    margin: '0 auto'
                                }}
                            >
                                {isGenerating ? <Spinner /> : <FaImage />}
                                {isGenerating ? 'Generating...' : 'Generate AI Image'}
                            </button>
                        </div>

                        {/* Generated Image Preview */}
                        {generatedImage && (
                            <div style={{ textAlign: 'center' }}>
                                <h4 style={{ color: '#333', marginBottom: '12px' }}>Generated Preview:</h4>
                                <div style={{ 
                                    display: 'inline-block',
                                    border: '2px solid #667eea',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    marginBottom: '12px'
                                }}>
                                    <img 
                                        src={generatedImage.src} 
                                        alt="AI Generated" 
                                        style={{ 
                                            width: '200px', 
                                            height: '200px', 
                                            objectFit: 'cover',
                                            display: 'block'
                                        }} 
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={useGeneratedImage}
                                        style={{
                                            background: '#28a745',
                                            color: 'white',
                                            border: 'none',
                                            padding: '8px 16px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >
                                        Use This Image
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearAiGeneration}
                                        style={{
                                            background: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            padding: '8px 16px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {media && (
                    <div style={{ marginTop: 10, maxHeight: 360, overflow: 'hidden', position: 'relative', background: '#000', borderRadius: 8 }}>
                        {media.uploading ? (
                            <div style={{ width: '100%', height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Spinner />
                            </div>
                        ) : media.kind === 'video' ? (
                            <video src={media.src} controls style={{ width: '100%', height: 360, objectFit: 'contain', display: 'block' }} />
                        ) : (
                            <img src={media.src} alt='preview' style={{ width: '100%', height: 360, objectFit: 'contain', display: 'block' }} />
                        )}
                        {media.isMockGenerated && (
                            <div style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                background: 'rgba(102, 126, 234, 0.9)',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <FaMagic />
                                Mock Generated
                            </div>
                        )}
                        {media.aiGenerated && !media.isMockGenerated && (
                            <div style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                background: 'rgba(102, 126, 234, 0.9)',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <FaMagic />
                                AI Generated ({media.storageType?.toUpperCase()})
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button type='submit' disabled={uploading || !media || media.uploading}>
                        {uploading ? 'Uploading…' : 'Post Story'}
                    </button>
                    {media && (
                        <button type='button' onClick={clearMedia} disabled={uploading}>
                            Remove
                        </button>
                    )}
                </div>
            </form>

            {status && <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>{status}</div>}
        </div>
    )
}

export default Stories
