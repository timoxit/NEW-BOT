const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('emojiinfo')
    .setDescription('Displays information about a server emoji')
    .addStringOption(option => option.setName('emoji').setDescription('The emoji character or name').setRequired(true)),

  async execute(interaction) {
    const emojiInput = interaction.options.getString('emoji');
    
    // Parse custom emoji ID if possible (e.g. <:emoji_name:1234567890>)
    const emojiRegex = /<?a?:?(\w+):(\d+)>/;
    const match = emojiInput.match(emojiRegex);
    let emojiId = emojiInput;
    if (match) {
      emojiId = match[2];
    }

    try {
      const emoji = await interaction.guild.emojis.fetch(emojiId);
      if (!emoji) {
        return interaction.reply({ embeds: [embeds.error('Emoji not found in this server!')], ephemeral: true });
      }

      const fields = [
        { name: 'Name', value: `\`:${emoji.name}:\``, inline: true },
        { name: 'ID', value: `\`${emoji.id}\``, inline: true },
        { name: 'Animated', value: emoji.animated ? 'Yes' : 'No', inline: true },
        { name: 'URL', value: `[Link](${emoji.url})`, inline: true }
      ];

      const embed = embeds.custom({
        title: `Emoji Info - :${emoji.name}:`,
        thumbnail: emoji.url,
        fields,
        color: '#5865F2'
      });

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ embeds: [embeds.error('Failed to parse or find custom emoji. Make sure it is from this server.')], ephemeral: true });
    }
  }
};
