const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Displays connection latency'),

  async execute(interaction) {
    const sent = await interaction.deferReply({ fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = interaction.client.ws.ping;

    const pingEmbed = embeds.custom({
      title: '🏓 Ping Results',
      fields: [
        { name: 'API Latency', value: `\`${latency}ms\``, inline: true },
        { name: 'Gateway Latency', value: `\`${wsPing}ms\``, inline: true }
      ],
      color: '#5865F2'
    });

    await interaction.editReply({ embeds: [pingEmbed] });
  }
};
