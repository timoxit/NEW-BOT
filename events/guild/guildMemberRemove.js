const logger = require('../../utils/logger');
const embeds = require('../../utils/embeds');
const Guild = require('../../models/Guild');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    try {
      const settings = await Guild.findOne({ guildId: member.guild.id });
      if (!settings) return;

      // 1. Goodbye Notification
      if (settings.goodbye.enabled && settings.goodbye.channelId) {
        const channel = member.guild.channels.cache.get(settings.goodbye.channelId);
        if (channel) {
          const goodbyeMsg = settings.goodbye.message
            .replace(/{user}/g, member.user.username)
            .replace(/{guild}/g, member.guild.name)
            .replace(/{memberCount}/g, member.guild.memberCount.toString());

          await channel.send({ content: goodbyeMsg }).catch(() => {});
        }
      }

      // 2. Member Leave Logs
      if (settings.logs.enabled && settings.logs.events.includes('guildMemberRemove')) {
        const logChannel = member.guild.channels.cache.get(settings.logs.channelId);
        if (logChannel) {
          const embed = embeds.error(
            `👤 <@${member.id}> (**${member.user.tag}**) left the server.\nID: \`${member.id}\`\nRoles: ${member.roles.cache.map(r => r.name).filter(n => n !== '@everyone').join(', ') || 'None'}`,
            'Member Left'
          );
          await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      }
    } catch (err) {
      logger.error('Error in guildMemberRemove event:', err);
    }
  }
};
