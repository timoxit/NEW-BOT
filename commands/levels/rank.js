const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const User = require('../../models/User');
const Guild = require('../../models/Guild');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Displays a member\'s server level and XP rank')
    .addUserOption(option => option.setName('user').setDescription('The user to check').setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;

    const settings = await Guild.findOne({ guildId: interaction.guild.id });
    if (!settings || !settings.levels.enabled) {
      return interaction.reply({ embeds: [embeds.error('Leveling system is not enabled on this server.')], ephemeral: true });
    }

    try {
      const userDoc = await User.findOne({ guildId: interaction.guild.id, userId: user.id });
      if (!userDoc) {
        return interaction.reply({ embeds: [embeds.info(`${user.id === interaction.user.id ? 'You do' : 'This user does'} not have any leveling data yet. Type some messages first!`)] });
      }

      // Calculate Rank Position
      const allUsers = await User.find({ guildId: interaction.guild.id });
      allUsers.sort((a, b) => {
        if (a.level === b.level) {
          return b.xp - a.xp;
        }
        return b.level - a.level;
      });

      const rank = allUsers.findIndex(u => u.userId === user.id) + 1;
      const nextLevelXp = userDoc.level * 100 + 100;
      const progressPercent = Math.min(Math.floor((userDoc.xp / nextLevelXp) * 100), 100);

      // Create a nice ascii progress bar
      const barLength = 10;
      const filledBars = Math.round((progressPercent / 100) * barLength);
      const emptyBars = barLength - filledBars;
      const progressBar = '🟩'.repeat(filledBars) + '⬜'.repeat(emptyBars);

      const rankEmbed = embeds.custom({
        title: `🏆 Level Rank - ${user.username}`,
        thumbnail: user.displayAvatarURL({ dynamic: true }),
        fields: [
          { name: 'Rank', value: `#${rank}`, inline: true },
          { name: 'Level', value: `${userDoc.level}`, inline: true },
          { name: 'Progress', value: `${userDoc.xp} / ${nextLevelXp} XP (${progressPercent}%)\n${progressBar}`, inline: false }
        ],
        color: '#5865F2'
      });

      await interaction.reply({ embeds: [rankEmbed] });
    } catch (err) {
      await interaction.reply({ embeds: [embeds.error(`Failed to retrieve rank: ${err.message}`)], ephemeral: true });
    }
  }
};
