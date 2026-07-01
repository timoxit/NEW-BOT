const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Displays information about this server'),

  async execute(interaction) {
    const { guild } = interaction;

    const channels = await guild.channels.fetch();
    const roles = await guild.roles.fetch();
    const emojis = await guild.emojis.fetch();

    const textChannels = channels.filter(c => c.type === 0).size;
    const voiceChannels = channels.filter(c => c.type === 2).size;
    const categoryChannels = channels.filter(c => c.type === 4).size;

    const fields = [
      { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
      { name: 'Created At', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:d>`, inline: true },
      { name: 'Total Members', value: `${guild.memberCount}`, inline: true },
      { name: 'Channels', value: `📁 ${categoryChannels} Categories\n💬 ${textChannels} Text\n🔊 ${voiceChannels} Voice`, inline: true },
      { name: 'Roles', value: `${roles.size}`, inline: true },
      { name: 'Emojis', value: `${emojis.size}`, inline: true }
    ];

    const embed = embeds.custom({
      title: `Server Info - ${guild.name}`,
      thumbnail: guild.iconURL({ dynamic: true }),
      fields,
      color: '#5865F2'
    });

    await interaction.reply({ embeds: [embed] });
  }
};
