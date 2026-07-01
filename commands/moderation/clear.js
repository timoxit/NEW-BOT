const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Bulk deletes messages in the current channel')
    .addIntegerOption(option => 
      option.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');

    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      const successEmbed = embeds.success(`Successfully cleared **${deleted.size}** messages.`);
      await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (err) {
      await interaction.reply({ embeds: [embeds.error(`Failed to clear messages: ${err.message}`)], ephemeral: true });
    }
  }
};
