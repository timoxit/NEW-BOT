const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const User = require('../../models/User');
const Guild = require('../../models/Guild');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Displays the server\'s top active members'),

  async execute(interaction) {
    const settings = await Guild.findOne({ guildId: interaction.guild.id });
    if (!settings || !settings.levels.enabled) {
      return interaction.reply({ embeds: [embeds.error('Leveling system is not enabled on this server.')], ephemeral: true });
    }

    try {
      const topUsers = await User.find({ guildId: interaction.guild.id })
        .sort({ level: -1, xp: -1 })
        .limit(10);

      if (topUsers.length === 0) {
        return interaction.reply({ embeds: [embeds.info('The leaderboard is currently empty.')] });
      }

      const descriptionLines = [];
      for (let i = 0; i < topUsers.length; i++) {
        const u = topUsers[i];
        let userTag = 'Unknown User';
        try {
          const discordUser = await interaction.client.users.fetch(u.userId);
          userTag = discordUser.tag;
        } catch (e) {
          // Fallback if user left Discord
        }
        
        const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
        descriptionLines.push(`${rankEmoji} **${userTag}** • Level **${u.level}** (${u.xp} XP)`);
      }

      const lbEmbed = embeds.custom({
        title: `🏆 Server Leaderboard - ${interaction.guild.name}`,
        description: descriptionLines.join('\n'),
        color: '#5865F2'
      });

      await interaction.reply({ embeds: [lbEmbed] });
    } catch (err) {
      await interaction.reply({ embeds: [embeds.error(`Failed to load leaderboard: ${err.message}`)], ephemeral: true });
    }
  }
};
