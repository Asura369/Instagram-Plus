import express from 'express'
import auth from '../middleware/auth.js'
import multer from 'multer'
import streamifier from 'streamifier'
import cloudinary from '../cloudinary.js'
import { generateAIStory, generateAIStoryWithImageGen } from '../services/geminiAI.js'

const router = express.Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024, files: 5 }
})

const uploadToCloudinary = (buffer, folder) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (err, result) => err ? reject(err) : resolve(result)
    )
    streamifier.createReadStream(buffer).pipe(stream)
})

router.post('/media', auth, upload.array('files', 5), async (req, res) => {
    try {
        if (!req.files?.length) return res.status(400).json({ message: 'no files' })
        const out = []
        for (const f of req.files) {
            const r = await uploadToCloudinary(f.buffer, 'instagram_plus')
            out.push({
                kind: r.resource_type === 'video' ? 'video' : 'image',
                src: r.secure_url,
                publicId: r.public_id,
                width: r.width,
                height: r.height,
                duration: r.duration
            })
        }
        res.status(201).json({ media: out })
    } catch (e) {
        console.error('upload error', e)
        res.status(500).json({ message: 'upload failed' })
    }
})

const destroyAsset = async publicId => {
    let resp = await cloudinary.uploader.destroy(publicId)
    if (resp.result !== 'ok' && resp.result !== 'not found') {
        resp = await cloudinary.uploader.destroy(publicId, { resource_type: 'video' })
    }
    return resp
}

router.delete('/media', auth, async (req, res) => {
    try {
        const { publicIds = [] } = req.body || {}
        const results = []
        for (const pid of publicIds) {
            results.push(await destroyAsset(pid))
        }
        res.json({ ok: true, results })
    } catch (e) {
        console.error('destroy error', e)
        res.status(500).json({ message: 'delete failed' })
    }
})

// AI Story Image Generation Endpoint
router.post('/generate-story', auth, upload.single('userPhoto'), async (req, res) => {
    try {
        const { theme, prompt } = req.body
        const userPhoto = req.file

        if (!userPhoto) {
            return res.status(400).json({ message: 'User photo is required' })
        }

        if (!theme) {
            return res.status(400).json({ message: 'Theme is required' })
        }

        // Upload user photo to Cloudinary first
        const userPhotoResult = await uploadToCloudinary(userPhoto.buffer, 'instagram_plus/user_photos')

        // REAL Gemini AI Image Generation
        let aiResult = null;
        let finalImageUrl = null;

        try {
            // Call Gemini AI to generate actual image
            console.log('Calling Gemini 2.5 Flash Image Preview for image generation...');
            aiResult = await generateAIStory(userPhoto.buffer, theme, prompt);

            if (aiResult.hasGeneratedImage && aiResult.imageData) {
                // Gemini generated an actual image - upload it to Cloudinary
                console.log('Gemini generated image successfully, uploading to Cloudinary...');

                // Convert base64 to buffer
                const imageBuffer = Buffer.from(aiResult.imageData, 'base64');

                // Upload the AI-generated image to Cloudinary
                const processedResult = await uploadToCloudinary(imageBuffer, 'instagram_plus/ai_generated');

                finalImageUrl = processedResult.secure_url;

                res.status(200).json({
                    success: true,
                    imageUrl: finalImageUrl,
                    publicId: processedResult.public_id,
                    theme,
                    aiGenerated: true,
                    enhancedWithGemini: true,
                    model: 'gemini-2.5-flash-image-preview',
                    message: `AI image generated with ${theme} theme using Gemini 2.5 Flash Image Preview`,
                    media: {
                        kind: 'image',
                        src: finalImageUrl,
                        publicId: processedResult.public_id,
                        width: processedResult.width || 400,
                        height: processedResult.height || 600
                    }
                });

            } else {
                // Gemini provided description but no image - use enhanced Cloudinary processing
                console.log('Gemini provided description, enhancing with Cloudinary...');

                const enhancedTransformations = getAIEnhancedTransformations(theme, aiResult.description);

                const processedResult = await cloudinary.uploader.upload(userPhotoResult.secure_url, {
                    folder: 'instagram_plus/ai_generated',
                    transformation: enhancedTransformations,
                    public_id: `ai_enhanced_${theme}_${Date.now()}`
                });

                finalImageUrl = processedResult.secure_url;

                res.status(200).json({
                    success: true,
                    imageUrl: finalImageUrl,
                    publicId: processedResult.public_id,
                    theme,
                    aiDescription: aiResult.description,
                    enhancedWithGemini: true,
                    model: 'gemini-2.5-flash-image-preview',
                    message: `AI-enhanced story with ${theme} theme using Gemini analysis`,
                    note: "Gemini provided analysis - enhanced with Cloudinary transformations",
                    media: {
                        kind: 'image',
                        src: finalImageUrl,
                        publicId: processedResult.public_id,
                        width: processedResult.width || 400,
                        height: processedResult.height || 600
                    }
                });
            }

        } catch (aiError) {
            console.error('Gemini AI failed, falling back to simple Cloudinary enhancements:', aiError);

            // Fallback to simpler Cloudinary transformations
            const simpleTransformations = [
                { width: 400, height: 600, crop: 'fill' },
                { effect: 'improve' },
                { effect: `colorize:30:${getThemeColor(theme)}` },
                { quality: 'auto:best' },
                { overlay: { 
                    text: `${theme.toUpperCase()} STORY`, 
                    font_family: 'Arial', 
                    font_size: 30, 
                    font_weight: 'bold',
                    color: 'white'
                  }, 
                  gravity: 'north', 
                  y: 20 
                }
            ];

            const processedResult = await cloudinary.uploader.upload(userPhotoResult.secure_url, {
                folder: 'instagram_plus/ai_generated',
                transformation: simpleTransformations,
                public_id: `fallback_${theme}_${Date.now()}`
            });

            res.status(200).json({
                success: true,
                imageUrl: processedResult.secure_url,
                publicId: processedResult.public_id,
                theme,
                enhancedWithGemini: false,
                fallbackUsed: true,
                aiError: aiError.message,
                message: `AI story generated with ${theme} theme (fallback mode)`,
                media: {
                    kind: 'image',
                    src: processedResult.secure_url,
                    publicId: processedResult.public_id,
                    width: processedResult.width || 400,
                    height: processedResult.height || 600
                }
            });
        }

    } catch (error) {
        console.error('AI generation error:', error)
        res.status(500).json({ 
            message: 'AI generation failed',
            error: error.message 
        })
    }
})

// Helper function to get theme colors
function getThemeColor(theme) {
    const themeColors = {
        beach: 'blue',
        mountains: 'green',
        city: 'gray',
        forest: 'darkgreen',
        desert: 'orange',
        sunset: 'red',
        space: 'purple',
        underwater: 'cyan'
    }
    return themeColors[theme] || 'blue'
}

// Helper function to get AI-enhanced transformations based on Gemini analysis
function getAIEnhancedTransformations(theme, aiDescription) {
    // Base transformations
    const transforms = [
        { width: 400, height: 600, crop: 'fill' },
        { effect: 'improve' }
    ];

    // Theme-specific enhancements (simplified to avoid conflicts)
    const themeEffects = {
        beach: [
            { effect: 'vibrance:20' },
            { effect: 'colorize:20:blue' }
        ],
        mountains: [
            { effect: 'contrast:15' },
            { effect: 'colorize:15:green' }
        ],
        city: [
            { effect: 'contrast:10' },
            { effect: 'colorize:10:gray' }
        ],
        forest: [
            { effect: 'vibrance:15' },
            { effect: 'colorize:20:green' }
        ],
        desert: [
            { effect: 'colorize:25:orange' },
            { effect: 'brightness:5' }
        ],
        sunset: [
            { effect: 'vibrance:25' },
            { effect: 'colorize:20:red' }
        ],
        space: [
            { effect: 'colorize:25:purple' },
            { effect: 'contrast:20' }
        ],
        underwater: [
            { effect: 'colorize:25:cyan' },
            { effect: 'brightness:-5' }
        ]
    };

    // Add theme-specific effects
    if (themeEffects[theme]) {
        transforms.push(...themeEffects[theme]);
    }

    // Add AI-powered text overlay
    transforms.push({
        overlay: { 
            text: `AI Enhanced: ${theme.toUpperCase()}`, 
            font_family: 'Arial', 
            font_size: 24, 
            font_weight: 'bold',
            color: 'white'
        }, 
        gravity: 'south_east', 
        x: 10, 
        y: 10 
    });

    // Final quality optimization
    transforms.push({ quality: 'auto:best' });

    return transforms;
}

export default router
