const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Removes timeout from a user')
    .addUserOption(option => option.setName('user').setDescription('The user to untimeout').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for removing the timeout').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ embeds: [embeds.error('That user is not in this server!')], ephemeral: true });
    }

    if (!member.communicationDisabledUntil) {
      return interaction.reply({ embeds: [embeds.error('This user is not timed out!')], ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({ embeds: [embeds.error('I cannot untimeout this user! Check my role permissions.')], ephemeral: true });
    }

    try {
      await member.timeout(null, `${interaction.user.tag}: ${reason}`);
      const successEmbed = embeds.success(`Successfully removed timeout from **${user.tag}**.\n**Reason:** ${reason}`);
      await interaction.reply({ embeds: [successEmbed] });
    } catch (err) {
      await interaction.reply({ embeds: [embeds.error(`Failed to remove timeout: ${err.message}`)], ephemeral: true });
    }
  }
};
