const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Displays the bot\'s uptime'),

  async execute(interaction) {
    let totalSeconds = (interaction.client.uptime / 1000);
    const days = Math.floor(totalSeconds / 86400);
    totalSeconds %= 86400;
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    const embed = embeds.info(`The bot has been active for: **${uptimeStr}**`, '⏰ Bot Uptime');
    await interaction.reply({ embeds: [embed] });
  }
};
