const logger = require('../utils/logger');

function initErrorHandler(client) {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error, origin) => {
    logger.error('Uncaught Exception:', error, 'origin:', origin);
  });

  process.on('uncaughtExceptionMonitor', (error, origin) => {
    logger.error('Uncaught Exception Monitor:', error, 'origin:', origin);
  });

  client.on('error', (error) => {
    logger.error('Discord client error:', error);
  });

  client.on('shardError', (error, shardId) => {
    logger.error(`Discord Shard ${shardId} error:`, error);
  });
  
  logger.info('Anti-crash error handling initialized.');
}

module.exports = { initErrorHandler };
