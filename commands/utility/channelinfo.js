const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channelinfo')
    .setDescription('Displays information about a channel')
    .addChannelOption(option => option.setName('channel').setDescription('The channel to inspect').setRequired(false)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    const fields = [
      { name: 'Channel Name', value: channel.name, inline: true },
      { name: 'ID', value: `\`${channel.id}\``, inline: true },
      { name: 'Type', value: `${channel.type}`, inline: true },
      { name: 'Position', value: `${channel.position}`, inline: true },
      { name: 'Category', value: channel.parent ? channel.parent.name : 'None', inline: true }
    ];

    if (channel.topic) {
      fields.push({ name: 'Topic', value: channel.topic, inline: false });
    }

    const embed = embeds.custom({
      title: `Channel Info - #${channel.name}`,
      fields,
      color: '#5865F2'
    });

    await interaction.reply({ embeds: [embed] });
  }
};
