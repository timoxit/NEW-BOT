const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bans a user from the server')
    .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for banning the user').setRequired(false))
    .addIntegerOption(option => 
      option.setName('delete_messages')
        .setDescription('Number of days of messages to delete')
        .setRequired(false)
        .addChoices(
          { name: 'Don\'t Delete', value: 0 },
          { name: 'Previous 24 Hours', value: 1 },
          { name: 'Previous 7 Days', value: 7 }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_messages') || 0;
    const deleteSeconds = deleteDays * 24 * 60 * 60;

    const member = interaction.guild.members.cache.get(user.id);

    if (user.id === interaction.user.id) {
      return interaction.reply({ embeds: [embeds.error('You cannot ban yourself!')], ephemeral: true });
    }

    if (user.id === interaction.guild.ownerId) {
      return interaction.reply({ embeds: [embeds.error('You cannot ban the server owner!')], ephemeral: true });
    }

    if (member) {
      if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply({ embeds: [embeds.error('You cannot ban a user with an equal or higher role than yours!')], ephemeral: true });
      }
      if (!member.bannable) {
        return interaction.reply({ embeds: [embeds.error('I cannot ban this user! Check my role permissions.')], ephemeral: true });
      }
    }

    try {
      await interaction.guild.bans.create(user.id, {
        deleteMessageSeconds: deleteSeconds,
        reason: `${interaction.user.tag}: ${reason}`
      });

      const successEmbed = embeds.success(`Successfully banned **${user.tag}**.\n**Reason:** ${reason}`);
      await interaction.reply({ embeds: [successEmbed] });
    } catch (err) {
      await interaction.reply({ embeds: [embeds.error(`Failed to ban user: ${err.message}`)], ephemeral: true });
    }
  }
};
