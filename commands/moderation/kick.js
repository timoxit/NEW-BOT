const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kicks a user from the server')
    .addUserOption(option => option.setName('user').setDescription('The user to kick').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for kicking the user').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ embeds: [embeds.error('That user is not in this server!')], ephemeral: true });
    }

    if (user.id === interaction.user.id) {
      return interaction.reply({ embeds: [embeds.error('You cannot kick yourself!')], ephemeral: true });
    }

    if (user.id === interaction.guild.ownerId) {
      return interaction.reply({ embeds: [embeds.error('You cannot kick the server owner!')], ephemeral: true });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ embeds: [embeds.error('You cannot kick a user with an equal or higher role than yours!')], ephemeral: true });
    }

    if (!member.kickable) {
      return interaction.reply({ embeds: [embeds.error('I cannot kick this user! Check my role permissions.')], ephemeral: true });
    }

    try {
      await member.kick(`${interaction.user.tag}: ${reason}`);
      const successEmbed = embeds.success(`Successfully kicked **${user.tag}**.\n**Reason:** ${reason}`);
      await interaction.reply({ embeds: [successEmbed] });
    } catch (err) {
      await interaction.reply({ embeds: [embeds.error(`Failed to kick user: ${err.message}`)], ephemeral: true });
    }
  }
};
