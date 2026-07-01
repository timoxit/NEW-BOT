const mongoose = require('mongoose');
const config = require('./config');
const logger = require('./utils/logger');

async function connectDatabase() {
  if (!config.mongoUri || config.mongoUri.includes('your_')) {
    logger.warn('MongoDB URI is set to default placeholder. Skipping database connection. Some features will not work!');
    return;
  }

  try {
    mongoose.connection.on('connected', () => {
      logger.info('Successfully connected to MongoDB.');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    await mongoose.connect(config.mongoUri);
  } catch (error) {
    logger.error('Failed to connect to MongoDB on startup:', error);
    process.exit(1);
  }
}

module.exports = { connectDatabase };
