const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Displays a user\'s avatar')
    .addUserOption(option => option.setName('user').setDescription('The user to view avatar for').setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const avatarUrl = user.displayAvatarURL({ dynamic: true, size: 1024 });

    const embed = embeds.custom({
      title: `Avatar - ${user.tag}`,
      image: avatarUrl,
      color: '#5865F2'
    });

    await interaction.reply({ embeds: [embed] });
  }
};
