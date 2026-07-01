const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function loadEvents(client) {
  const eventsPath = path.join(__dirname, '../events');

  if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath);
  }

  const eventCategories = fs.readdirSync(eventsPath);

  for (const category of eventCategories) {
    const categoryPath = path.join(eventsPath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const eventFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
      const filePath = path.join(categoryPath, file);
      try {
        const event = require(filePath);
        if (!event.name || typeof event.execute !== 'function') {
          logger.warn(`Event file at ${filePath} is missing a name or execute function.`);
          continue;
        }

        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args, client));
        } else {
          client.on(event.name, (...args) => event.execute(...args, client));
        }

        logger.info(`Loaded event: ${event.name} [Category: ${category}]`);
      } catch (error) {
        logger.error(`Error loading event file ${file}:`, error);
      }
    }
  }
}

module.exports = { loadEvents };
