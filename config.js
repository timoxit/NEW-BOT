require('dotenv').config();

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  ownerId: process.env.OWNER_ID,
  mongoUri: process.env.MONGODB_URI,
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Validate critical values (except when placeholders are present or in dry-runs)
const missing = [];
if (!config.token || config.token === 'your_bot_token_here') missing.push('DISCORD_TOKEN');
if (!config.clientId || config.clientId === 'your_client_id_here') missing.push('CLIENT_ID');
if (!config.mongoUri || config.mongoUri === 'mongodb://localhost:27017/enterprise-bot') {
  // Let it pass but log a warning if it's default
}

if (missing.length > 0 && process.argv[2] !== '--check-only') {
  console.warn(`[WARNING] Configuration is missing fields: ${missing.join(', ')}. Please configure your .env file.`);
}

module.exports = config;
