const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Puts a user in timeout (mute)')
    .addUserOption(option => option.setName('user').setDescription('The user to timeout').setRequired(true))
    .addIntegerOption(option => option.setName('duration').setDescription('Timeout duration in minutes').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for timing out the user').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const duration = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ embeds: [embeds.error('That user is not in this server!')], ephemeral: true });
    }

    if (user.id === interaction.user.id) {
      return interaction.reply({ embeds: [embeds.error('You cannot timeout yourself!')], ephemeral: true });
    }

    if (user.id === interaction.guild.ownerId) {
      return interaction.reply({ embeds: [embeds.error('You cannot timeout the server owner!')], ephemeral: true });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ embeds: [embeds.error('You cannot timeout a user with an equal or higher role than yours!')], ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({ embeds: [embeds.error('I cannot timeout this user! Check my role permissions.')], ephemeral: true });
    }

    try {
      const milliseconds = duration * 60 * 1000;
      await member.timeout(milliseconds, `${interaction.user.tag}: ${reason}`);
      const successEmbed = embeds.success(`Successfully timed out **${user.tag}** for **${duration} minutes**.\n**Reason:** ${reason}`);
      await interaction.reply({ embeds: [successEmbed] });
    } catch (err) {
      await interaction.reply({ embeds: [embeds.error(`Failed to timeout user: ${err.message}`)], ephemeral: true });
    }
  }
};
