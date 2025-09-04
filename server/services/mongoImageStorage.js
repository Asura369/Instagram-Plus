import Image from '../models/Image.js'
import mongoose from 'mongoose'

// Store image in MongoDB
export async function storeImageInMongoDB(imageBuffer, metadata) {
    try {
        const image = new Image({
            filename: metadata.filename || `image_${Date.now()}.jpg`,
            contentType: metadata.contentType || 'image/jpeg',
            size: imageBuffer.length,
            data: imageBuffer,
            uploadedBy: metadata.uploadedBy,
            metadata: {
                width: metadata.width,
                height: metadata.height,
                theme: metadata.theme,
                aiGenerated: metadata.aiGenerated || false,
                model: metadata.model,
                prompt: metadata.prompt
            }
        })

        const savedImage = await image.save()
        console.log('Image stored in MongoDB:', savedImage._id)
        
        return {
            success: true,
            imageId: savedImage._id.toString(),
            size: savedImage.size,
            contentType: savedImage.contentType,
            dataUrl: savedImage.dataUrl,
            metadata: savedImage.getMetadata()
        }
    } catch (error) {
        console.error('Error storing image in MongoDB:', error)
        throw new Error(`Failed to store image: ${error.message}`)
    }
}

// Retrieve image from MongoDB
export async function getImageFromMongoDB(imageId) {
    try {
        if (!mongoose.Types.ObjectId.isValid(imageId)) {
            throw new Error('Invalid image ID')
        }

        const image = await Image.findById(imageId)
        if (!image) {
            throw new Error('Image not found')
        }

        return {
            success: true,
            image: {
                id: image._id.toString(),
                filename: image.filename,
                contentType: image.contentType,
                size: image.size,
                dataUrl: image.dataUrl,
                metadata: image.metadata,
                uploadedBy: image.uploadedBy,
                createdAt: image.createdAt
            }
        }
    } catch (error) {
        console.error('Error retrieving image from MongoDB:', error)
        throw new Error(`Failed to retrieve image: ${error.message}`)
    }
}

// Get image metadata only (without image data)
export async function getImageMetadata(imageId) {
    try {
        if (!mongoose.Types.ObjectId.isValid(imageId)) {
            throw new Error('Invalid image ID')
        }

        const image = await Image.findById(imageId).select('-data')
        if (!image) {
            throw new Error('Image not found')
        }

        return {
            success: true,
            metadata: image.getMetadata()
        }
    } catch (error) {
        console.error('Error retrieving image metadata:', error)
        throw new Error(`Failed to retrieve metadata: ${error.message}`)
    }
}

// Delete image from MongoDB
export async function deleteImageFromMongoDB(imageId, userId) {
    try {
        if (!mongoose.Types.ObjectId.isValid(imageId)) {
            throw new Error('Invalid image ID')
        }

        const image = await Image.findOneAndDelete({ 
            _id: imageId, 
            uploadedBy: userId 
        })
        
        if (!image) {
            throw new Error('Image not found or not authorized to delete')
        }

        console.log('Image deleted from MongoDB:', imageId)
        return { success: true, deletedId: imageId }
    } catch (error) {
        console.error('Error deleting image from MongoDB:', error)
        throw new Error(`Failed to delete image: ${error.message}`)
    }
}

// Get user's images
export async function getUserImages(userId, options = {}) {
    try {
        const {
            page = 1,
            limit = 10,
            aiGenerated = null,
            theme = null
        } = options

        const query = { uploadedBy: userId }
        
        if (aiGenerated !== null) {
            query['metadata.aiGenerated'] = aiGenerated
        }
        
        if (theme) {
            query['metadata.theme'] = theme
        }

        const images = await Image.find(query)
            .select('-data') // Exclude heavy image data
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec()

        const total = await Image.countDocuments(query)

        return {
            success: true,
            images: images.map(img => img.getMetadata()),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        }
    } catch (error) {
        console.error('Error getting user images:', error)
        throw new Error(`Failed to get user images: ${error.message}`)
    }
}

// Serve image endpoint helper
export async function serveImage(imageId) {
    try {
        const result = await getImageFromMongoDB(imageId)
        return {
            success: true,
            buffer: Buffer.from(result.image.dataUrl.split(',')[1], 'base64'),
            contentType: result.image.contentType,
            filename: result.image.filename
        }
    } catch (error) {
        throw error
    }
}

export default {
    storeImageInMongoDB,
    getImageFromMongoDB,
    getImageMetadata,
    deleteImageFromMongoDB,
    getUserImages,
    serveImage
}
