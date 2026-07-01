const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const mongoose = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Displays diagnostics and performance statistics'),

  async execute(interaction) {
    const client = interaction.client;
    
    // Calculate Memory Usage
    const memory = process.memoryUsage();
    const usedMemory = (memory.heapUsed / 1024 / 1024).toFixed(2);

    // Database Status
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? '🟢 Connected' : dbState === 2 ? '🟡 Connecting' : '🔴 Disconnected';

    const fields = [
      { name: 'Servers Count', value: `\`${client.guilds.cache.size}\``, inline: true },
      { name: 'Users Count', value: `\`${client.users.cache.size}\``, inline: true },
      { name: 'Node Version', value: `\`${process.version}\``, inline: true },
      { name: 'Discord.js', value: '`v14.15.3`', inline: true },
      { name: 'Memory Load', value: `\`${usedMemory} MB\``, inline: true },
      { name: 'Database Status', value: dbStatus, inline: true }
    ];

    const embed = embeds.custom({
      title: `⚙️ Diagnostic Report - ${client.user.username}`,
      fields,
      color: '#5865F2'
    });

    await interaction.reply({ embeds: [embed] });
  }
};
