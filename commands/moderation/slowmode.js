const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Sets or disables slowmode on a channel')
    .addIntegerOption(option => 
      option.setName('seconds')
        .setDescription('Slowmode delay in seconds (0 to disable)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    )
    .addChannelOption(option => option.setName('channel').setDescription('The channel to configure').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('seconds');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    try {
      await channel.setRateLimitPerUser(seconds);
      const successEmbed = embeds.success(
        seconds === 0 
          ? `Disabled slowmode for <#${channel.id}>.` 
          : `Set slowmode for <#${channel.id}> to **${seconds} seconds**.`
      );
      await interaction.reply({ embeds: [successEmbed] });
    } catch (err) {
      await interaction.reply({ embeds: [embeds.error(`Failed to set slowmode: ${err.message}`)], ephemeral: true });
    }
  }
};
