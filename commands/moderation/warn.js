const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');
const Warning = require('../../models/Warning');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issues a warning to a server member')
    .addUserOption(option => option.setName('user').setDescription('The user to warn').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for warning the user').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const member = interaction.guild.members.cache.get(user.id);

    if (user.bot) {
      return interaction.reply({ embeds: [embeds.error('You cannot warn bots!')], ephemeral: true });
    }

    if (user.id === interaction.user.id) {
      return interaction.reply({ embeds: [embeds.error('You cannot warn yourself!')], ephemeral: true });
    }

    if (member) {
      if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply({ embeds: [embeds.error('You cannot warn a user with an equal or higher role than yours!')], ephemeral: true });
      }
    }

    try {
      const warning = new Warning({
        guildId: interaction.guild.id,
        userId: user.id,
        moderatorId: interaction.user.id,
        reason
      });

      await warning.save();

      // Attempt to DM the user
      try {
        const dmEmbed = embeds.error(`You have been warned in **${interaction.guild.name}**.\n**Reason:** ${reason}`, '⚠️ Warning Issued');
        await user.send({ embeds: [dmEmbed] });
      } catch (err) {
        // Ignore DM blocks
      }

      const successEmbed = embeds.success(`Successfully warned **${user.tag}**.\n**Reason:** ${reason}`);
      await interaction.reply({ embeds: [successEmbed] });
    } catch (err) {
      await interaction.reply({ embeds: [embeds.error(`Failed to warn user: ${err.message}`)], ephemeral: true });
    }
  }
};
