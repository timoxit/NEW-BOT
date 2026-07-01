const logger = require('../../utils/logger');
const embeds = require('../../utils/embeds');
const Guild = require('../../models/Guild');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    try {
      const settings = await Guild.findOne({ guildId: ban.guild.id });
      if (!settings || !settings.logs.enabled || !settings.logs.events.includes('guildBanAdd')) return;

      const logChannel = ban.guild.channels.cache.get(settings.logs.channelId);
      if (logChannel) {
        const embed = embeds.error(
          `🔴 **User Banned**\n**User:** <@${ban.user.id}> (${ban.user.tag})\n**ID:** \`${ban.user.id}\`\n**Reason:** ${ban.reason || 'No reason provided'}`,
          'Ban Logged'
        );
        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err) {
      logger.error('Error in guildBanAdd event:', err);
    }
  }
};
