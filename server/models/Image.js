import mongoose from 'mongoose'
const { ObjectId } = mongoose.Schema.Types

// MongoDB Image Storage Schema - stores actual image data
const imageSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true }, // Actual image data
    uploadedBy: { type: ObjectId, ref: 'User', required: true },
    metadata: {
        width: Number,
        height: Number,
        theme: String,
        aiGenerated: { type: Boolean, default: false },
        model: String, // e.g., 'gemini-2.5-flash-image-preview'
        prompt: String
    }
}, { timestamps: true })

// Index for efficient queries
imageSchema.index({ uploadedBy: 1, createdAt: -1 })
imageSchema.index({ 'metadata.aiGenerated': 1 })

// Virtual for getting image as base64 data URL
imageSchema.virtual('dataUrl').get(function() {
    return `data:${this.contentType};base64,${this.data.toString('base64')}`
})

// Method to get image metadata only (without heavy data field)
imageSchema.methods.getMetadata = function() {
    const { data, ...metadata } = this.toObject()
    return metadata
}

export default mongoose.model('Image', imageSchema)
