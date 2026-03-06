const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/conversations
router.get('/', async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'username avatar isOnline lastSeen')
      .populate('lastMessage.sender', 'username')
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json({ success: true, conversations });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch conversations.' });
  }
});

// POST /api/conversations — create or get existing DM
router.post('/', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required.' });
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot create conversation with yourself.' });
    }

    // Return existing DM if it already exists
    const existing = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, userId], $size: 2 },
    }).populate('participants', 'username avatar isOnline lastSeen');

    if (existing) return res.json({ success: true, conversation: existing, isNew: false });

    const conversation = await Conversation.create({
      isGroup: false,
      participants: [req.user._id, userId],
    });

    const populated = await Conversation.findById(conversation._id).populate(
      'participants', 'username avatar isOnline lastSeen'
    );

    res.status(201).json({ success: true, conversation: populated, isNew: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create conversation.' });
  }
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user._id,
    });
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      conversationId: req.params.id,
      deletedFor: { $ne: req.user._id },
    })
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Message.countDocuments({ conversationId: req.params.id });

    // Mark messages as read
    await Message.updateMany(
      { conversationId: req.params.id, 'readBy.user': { $ne: req.user._id } },
      { $addToSet: { readBy: { user: req.user._id, readAt: new Date() } } }
    );

    res.json({
      success: true,
      messages: messages.reverse(),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
  }
});

module.exports = router;
