const express = require('express');
const {
  getProfile,
  updateProfile,
  addExperience,
  deleteExperience
} = require('../controllers/profileController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/me', protect, getProfile);
router.get('/:id', protect, getProfile);
router.put('/update', protect, upload.single('profileImage'), updateProfile);
router.post('/add-experience', protect, addExperience);
router.delete('/delete-experience/:id', protect, deleteExperience);

module.exports = router;
