const logger = require('../../utils/logger');

module.exports = {
  name: 'rateLimit',
  execute(rateLimitData) {
    logger.warn(`Rate Limit Triggered! Timeout: ${rateLimitData.timeout}ms, Limit: ${rateLimitData.limit}, Method: ${rateLimitData.method}, Path: ${rateLimitData.path}`);
  }
};
