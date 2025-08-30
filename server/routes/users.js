import express from 'express'
import User from '../models/User.js'
import auth from '../middleware/auth.js'

const router = express.Router()

router.patch('/viewedStories', auth, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.userId,
            { $addToSet: {storiesViewed: req.body.authorId} }
        )
        res.status(200).json(user)
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

router.get('/viewedStories', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("storiesViewed")
        res.status(200).json(user)
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select('-password')
            .populate('followers', 'username profilePic')
            .populate('following', 'username profilePic')
        res.status(200).json(user)
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

router.patch('/editProfile', auth, async (req, res) => {
    const { username, profilePic } = req.body

    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' })
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.userId,
            { username, profilePic },
            { new: true }
        ).select('-password')

        res.status(200).json(updatedUser)
    } catch (err) {
        console.error('Error updating profile:', err)
        res.status(500).json({ message: err.message })
    }
})

router.patch('/:id/follow', auth, async (req, res) => {
    try {
        const target = await User.findById(req.params.id)
        const me = await User.findById(req.userId)

        if (!target.followers.includes(req.userId)) {
            target.followers.push(req.userId)
            me.following.push(req.params.id)
        } else {
            target.followers = target.followers.filter(id => id.toString() !== req.userId)
            me.following = me.following.filter(id => id.toString() !== req.params.id)
        }

        await target.save()
        await me.save()

        res.status(200).json({ message: 'Updated follow status' })
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

router.get('/', async (req, res) => {
    try {
        const users = await User.find().select('-password').limit(20)
        res.status(200).json(users)
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params
        const users = await User.find({
            username: { $regex: query, $options: 'i' }
        }).select('-password').limit(10)
        res.status(200).json(users)
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('followers', 'username profilePic')
            .populate('following', 'username profilePic')
        res.status(200).json(user)
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

export default router
