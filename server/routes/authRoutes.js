const express = require('express');
const {
  register,
  login,
  updateProfile,
  getUsers,
  getPendingUsers,
  approveUser,
  rejectUser
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.get('/users', protect, getUsers);
router.get('/users/pending', protect, authorize('admin'), getPendingUsers);
router.patch('/users/approve/:id', protect, authorize('admin'), approveUser);
router.patch('/users/reject/:id', protect, authorize('admin'), rejectUser);

module.exports = router;
