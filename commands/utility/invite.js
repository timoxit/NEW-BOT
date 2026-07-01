const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get invite link for the bot'),

  async execute(interaction) {
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${interaction.client.user.id}&permissions=8&scope=bot%20applications.commands`;

    const embed = embeds.info(
      'Invite this bot to your server by clicking the button below. Administrator permissions are recommended for full feature sets.',
      '🔗 Bot Invitation'
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Invite Bot')
        .setStyle(ButtonStyle.Link)
        .setURL(inviteUrl)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
