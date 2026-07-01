const { ActivityType } = require('discord.js');
const logger = require('../../utils/logger');
const Giveaway = require('../../models/Giveaway');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`Logged in as ${client.user.tag}!`);

    // Set activity
    client.user.setPresence({
      activities: [{ name: 'Enterprise Security', type: ActivityType.Watching }],
      status: 'online',
    });

    // Register slash commands globally
    try {
      const commandData = client.commands.map(cmd => cmd.data.toJSON());
      await client.application.commands.set(commandData);
      logger.info('Successfully registered application (/) commands globally.');
    } catch (error) {
      logger.error('Error registering application commands:', error);
    }

    // Start giveaway status checker loop (every 10 seconds)
    setInterval(async () => {
      try {
        const now = new Date();
        const activeGiveaways = await Giveaway.find({ ended: false, paused: false, endTime: { $lte: now } });

        for (const giveaway of activeGiveaways) {
          try {
            const channel = await client.channels.fetch(giveaway.channelId);
            if (!channel) continue;

            const message = await channel.messages.fetch(giveaway.messageId);
            if (!message) continue;

            // Resolve winners
            const { enteredUsers, winnerCount, prize } = giveaway;
            if (enteredUsers.length === 0) {
              await message.reply({ content: '🎉 The giveaway has ended, but there were no valid participants!' });
              giveaway.ended = true;
              await giveaway.save();
              continue;
            }

            const winners = [];
            const tempUsers = [...enteredUsers];
            const actualWinnerCount = Math.min(winnerCount, tempUsers.length);

            for (let i = 0; i < actualWinnerCount; i++) {
              const randomIndex = Math.floor(Math.random() * tempUsers.length);
              winners.push(tempUsers.splice(randomIndex, 1)[0]);
            }

            giveaway.winners = winners;
            giveaway.ended = true;
            await giveaway.save();

            const winnerMentions = winners.map(w => `<@${w}>`).join(', ');
            await message.reply({
              content: `🎉 **GIVEAWAY ENDED** 🎉\nCongratulations to ${winnerMentions}! You won **${prize}**!`
            });

            // Edit original message
            const endEmbed = message.embeds[0];
            if (endEmbed) {
              const updatedEmbed = {
                ...endEmbed.toJSON(),
                description: `Hosted by: <@${giveaway.hostedBy}>\nWinners: ${winnerMentions}\n\nEnded.`,
                color: 0x2B2D31
              };
              await message.edit({ embeds: [updatedEmbed], components: [] });
            }
          } catch (e) {
            logger.error(`Error processing ending giveaway ${giveaway.messageId}:`, e);
            giveaway.ended = true; // Mark ended to avoid infinite loop
            await giveaway.save();
          }
        }
      } catch (err) {
        logger.error('Error running giveaway check interval:', err);
      }
    }, 10000);
  }
};
