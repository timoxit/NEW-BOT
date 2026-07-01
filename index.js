const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config');
const { connectDatabase } = require('./database');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const { initErrorHandler } = require('./handlers/errorHandler');
const logger = require('./utils/logger');

// Create discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildEmojisAndStickers
  ]
});

// Cache collections
client.commands = new Collection();

// 1. Initialize Anti-crash process handlers
initErrorHandler(client);

// 2. Load handlers
try {
  loadCommands(client);
  loadEvents(client);
} catch (err) {
  logger.error('Failed to load handlers on startup:', err);
  process.exit(1);
}

// 3. Dry-run Check support
if (process.argv.includes('--check-only')) {
  logger.info('Dry run syntax check completed successfully. All components compiled.');
  process.exit(0);
}

// 4. Connect database & Login
async function startBot() {
  await connectDatabase();
  
  if (!config.token || config.token === 'your_bot_token_here') {
    logger.error('CRITICAL: Discord Token is not set in .env! Exiting...');
    process.exit(1);
  }

  try {
    await client.login(config.token);
  } catch (error) {
    logger.error('Client login failed:', error);
    process.exit(1);
  }
}

startBot();
