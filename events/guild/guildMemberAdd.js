const logger = require('../../utils/logger');
const embeds = require('../../utils/embeds');
const Guild = require('../../models/Guild');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      const settings = await Guild.findOne({ guildId: member.guild.id });
      if (!settings) return;

      // 0. Anti-Raid check
      if (settings.automod.enabled && settings.automod.antiraid) {
        await member.kick('Anti-Raid protection enabled. Joins locked.').catch(() => {});
        if (settings.logs.enabled && settings.logs.events.includes('guildMemberRemove')) {
          const logChannel = member.guild.channels.cache.get(settings.logs.channelId);
          if (logChannel) {
            const embed = embeds.error(`🛡️ **Anti-Raid Action**\nKicked joining user <@${member.id}> (${member.user.tag}) to protect the server.`);
            await logChannel.send({ embeds: [embed] }).catch(() => {});
          }
        }
        return;
      }

      // 1. Auto Role Assign
      if (settings.welcome.enabled && settings.welcome.autoRoleId) {
        const role = member.guild.roles.cache.get(settings.welcome.autoRoleId);
        if (role) {
          await member.roles.add(role).catch(err => logger.error(`Failed to assign autorole: ${err.message}`));
        }
      }

      // 2. Welcome Notification
      if (settings.welcome.enabled && settings.welcome.channelId) {
        const channel = member.guild.channels.cache.get(settings.welcome.channelId);
        if (channel) {
          let title = settings.welcome.embedTitle
            .replace(/{user}/g, member.user.username)
            .replace(/{memberCount}/g, member.guild.memberCount.toString())
            .replace(/{guild}/g, member.guild.name);

          let desc = settings.welcome.embedDesc
            .replace(/{user}/g, `<@${member.id}>`)
            .replace(/{memberCount}/g, member.guild.memberCount.toString())
            .replace(/{guild}/g, member.guild.name);

          const welcomeEmbed = embeds.custom({
            title,
            description: desc,
            color: settings.welcome.embedColor,
            thumbnail: settings.welcome.thumbnail ? member.user.displayAvatarURL({ dynamic: true }) : null
          });

          await channel.send({ content: `<@${member.id}>`, embeds: [welcomeEmbed] }).catch(() => {});
        }
      }

      // 3. Member Logs
      if (settings.logs.enabled && settings.logs.events.includes('guildMemberAdd')) {
        const logChannel = member.guild.channels.cache.get(settings.logs.channelId);
        if (logChannel) {
          const embed = embeds.success(
            `👤 <@${member.id}> (**${member.user.tag}**) joined the server.\nID: \`${member.id}\`\nAccount Created: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
            'Member Joined'
          );
          await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      }
    } catch (err) {
      logger.error('Error in guildMemberAdd event:', err);
    }
  }
};
