import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Function to convert file buffer to generative part
function fileToGenerativePart(buffer, mimeType) {
    return {
        inlineData: {
            data: buffer.toString('base64'),
            mimeType
        },
    };
}

// Generate AI image with Gemini
export async function generateAIStory(userPhotoBuffer, theme, customPrompt = null) {
    try {
        console.log('=== Gemini AI Generation Start ===');
        
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is required');
        }

        if (!userPhotoBuffer || userPhotoBuffer.length === 0) {
            throw new Error('User photo buffer is empty or invalid');
        }

        console.log('User photo buffer size:', userPhotoBuffer.length);
        console.log('Theme:', theme);

        // Get the appropriate model for image generation
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image-preview" });
        console.log('Gemini model initialized');

        // Define theme-specific prompts
        const themePrompts = {
            beach: "a beautiful tropical beach with crystal clear water, palm trees, white sand, and sunset colors in the background",
            mountains: "majestic snow-capped mountains with dramatic peaks, alpine meadows, and cloudy skies",
            city: "a modern urban cityscape with skyscrapers, neon lights, and bustling streets at golden hour",
            forest: "a lush green forest with tall trees, dappled sunlight, moss-covered rocks, and mystical atmosphere",
            desert: "golden sand dunes in a vast desert with dramatic lighting and distant mountains on the horizon",
            sunset: "a breathtaking sunset sky with vibrant orange, pink, and purple colors reflected on water",
            space: "a cosmic scene with stars, nebulae, galaxies, and ethereal space phenomena in deep blues and purples",
            underwater: "an underwater scene with coral reefs, tropical fish, and filtered sunlight streaming down"
        };

        const themeDescription = themePrompts[theme] || themePrompts.beach;
        
        // Create the prompt for actual image generation
        const prompt = customPrompt || 
            `Generate a stunning, photorealistic image that seamlessly places the person from the reference photo into ${themeDescription}. 
             The person should appear naturally integrated into the scene with proper lighting, shadows, and perspective. 
             Make it look like a professional photo shoot in this environment. 
             High quality, cinematic composition, detailed textures.
             Keep the person's appearance and clothing identical to the reference image.`;

        // Convert user photo to generative part
        const imagePart = fileToGenerativePart(userPhotoBuffer, 'image/jpeg');

        console.log('Generating AI image with Gemini...');
        console.log('Prompt length:', prompt.length);

        // Add timeout and retry logic
        const generateWithTimeout = async (timeoutMs = 30000) => {
            return Promise.race([
                model.generateContent([prompt, imagePart]),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Gemini API timeout')), timeoutMs)
                )
            ]);
        };

        const result = await generateWithTimeout();
        const response = await result.response;
        console.log('Gemini response received');

        // Check if the response contains generated images
        const candidates = response.candidates;
        if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
            const parts = candidates[0].content.parts;
            
            // Look for image data in the response
            const imagePart = parts.find(part => part.inlineData && part.inlineData.mimeType.startsWith('image/'));
            
            if (imagePart) {
                // Extract the generated image data
                const imageBase64 = imagePart.inlineData.data;
                const mimeType = imagePart.inlineData.mimeType;
                
                console.log('Gemini generated image successfully');
                
                return {
                    success: true,
                    imageData: imageBase64,
                    mimeType: mimeType,
                    theme,
                    prompt,
                    hasGeneratedImage: true,
                    description: 'AI-generated image using Gemini 2.5 Flash Image Preview'
                };
            }
        }

        // If no image was generated, get text response as fallback
        const text = response.text();
        console.log('Gemini AI Response (text only):', text);

        return {
            success: true,
            description: text,
            theme,
            prompt,
            hasGeneratedImage: false,
            imageData: null
        };

    } catch (error) {
        console.error('=== Gemini AI Error ===');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Provide more specific error messages
        if (error.message.includes('API key')) {
            throw new Error('Invalid or missing Gemini API key');
        } else if (error.message.includes('timeout')) {
            throw new Error('Gemini AI service timeout - please try again');
        } else if (error.message.includes('quota')) {
            throw new Error('Gemini API quota exceeded');
        } else if (error.message.includes('safety')) {
            throw new Error('Image content was blocked by safety filters');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            throw new Error('Network error connecting to Gemini AI');
        } else {
            throw new Error(`AI generation failed: ${error.message}`);
        }
    }
}

// Alternative: Generate AI image using Gemini + Image Generation Service
export async function generateAIStoryWithImageGen(userPhotoBuffer, theme, customPrompt = null) {
    try {
        // First, use Gemini to enhance the prompt based on the user photo and theme
        const enhancedPrompt = await generateAIStory(userPhotoBuffer, theme, customPrompt);
        
        // Here you would call an actual image generation API like:
        // - OpenAI DALL-E
        // - Stability AI
        // - Midjourney API
        // - Hugging Face Diffusers
        
        // For demonstration, we'll use a placeholder
        console.log('Enhanced AI Prompt:', enhancedPrompt.description);
        
        // This is where you'd call the actual image generation service
        // const generatedImageUrl = await callImageGenerationAPI(enhancedPrompt.description);
        
        return {
            success: true,
            enhancedPrompt: enhancedPrompt.description,
            theme,
            // imageUrl: generatedImageUrl, // Would be the actual generated image
            imageUrl: null, // Placeholder for now
            needsImageGeneration: true
        };

    } catch (error) {
        console.error('AI Story Generation Error:', error);
        throw error;
    }
}

export default { generateAIStory, generateAIStoryWithImageGen };
