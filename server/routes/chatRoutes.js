const express = require('express');
const {
  getChatBootstrap,
  getDirectMessages,
  getGroupMessages,
  sendMessage,
  markConversationSeen,
  editMessage,
  deleteMessage,
  createGroup,
  updateGroupMembers
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');
const uploadChat = require('../middleware/uploadChat');

const router = express.Router();

router.use(protect);

router.get('/bootstrap', getChatBootstrap);
router.get('/users', getChatBootstrap);
router.get('/direct/:userId', getDirectMessages);
router.get('/group/:groupId', getGroupMessages);
router.put('/seen/:type/:targetId', markConversationSeen);
router.put('/edit/:id', editMessage);
router.delete('/delete/:id', deleteMessage);
router.post('/send', uploadChat.single('file'), sendMessage);
router.post('/groups', createGroup);
router.put('/groups/:id/members', updateGroupMembers);

module.exports = router;
