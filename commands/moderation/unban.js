const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unbans a user from the server')
    .addStringOption(option => option.setName('user_id').setDescription('The Discord ID of the user to unban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for unbanning').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      // Check if user is actually banned
      const bans = await interaction.guild.bans.fetch();
      const isBanned = bans.has(userId);

      if (!isBanned) {
        return interaction.reply({ embeds: [embeds.error('This user ID is not banned from this server!')], ephemeral: true });
      }

      await interaction.guild.bans.remove(userId, `${interaction.user.tag}: ${reason}`);
      
      const successEmbed = embeds.success(`Successfully unbanned user ID \`${userId}\`.\n**Reason:** ${reason}`);
      await interaction.reply({ embeds: [successEmbed] });
    } catch (err) {
      await interaction.reply({ embeds: [embeds.error(`Failed to unban user: ${err.message}`)], ephemeral: true });
    }
  }
};
