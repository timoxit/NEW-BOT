const logger = require('../../utils/logger');
const embeds = require('../../utils/embeds');
const Guild = require('../../models/Guild');

module.exports = {
  name: 'guildBanRemove',
  async execute(ban) {
    try {
      const settings = await Guild.findOne({ guildId: ban.guild.id });
      if (!settings || !settings.logs.enabled || !settings.logs.events.includes('guildBanRemove')) return;

      const logChannel = ban.guild.channels.cache.get(settings.logs.channelId);
      if (logChannel) {
        const embed = embeds.success(
          `🟢 **User Unbanned**\n**User:** <@${ban.user.id}> (${ban.user.tag})\n**ID:** \`${ban.user.id}\``,
          'Unban Logged'
        );
        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err) {
      logger.error('Error in guildBanRemove event:', err);
    }
  }
};
