const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

console.log('--- Startup Debug ---');
console.log('Dirname:', __dirname);
const result = dotenv.config({ path: path.join(__dirname, '.env') });
if (result.error) {
  console.error('Dotenv error:', result.error);
} else {
  console.log('Dotenv loaded successfully');
}

console.log('PORT:', process.env.PORT);
console.log('MONGO_URI exists:', !!process.env.MONGO_URI);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connection test: SUCCESS');
    process.exit(0);
  })
  .catch((err) => {
    console.error('MongoDB connection test: FAILED', err.message);
    process.exit(1);
  });
