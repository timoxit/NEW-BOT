const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Locks the current or specified channel')
    .addChannelOption(option => option.setName('channel').setDescription('The channel to lock').setRequired(false))
    .addStringOption(option => option.setName('reason').setDescription('Reason for the lock').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false
      }, { reason: `${interaction.user.tag}: ${reason}` });

      const successEmbed = embeds.success(`Successfully locked channel <#${channel.id}>.\n**Reason:** ${reason}`);
      await interaction.reply({ embeds: [successEmbed] });
    } catch (err) {
      await interaction.reply({ embeds: [embeds.error(`Failed to lock channel: ${err.message}`)], ephemeral: true });
    }
  }
};
