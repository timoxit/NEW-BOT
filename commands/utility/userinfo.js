const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Displays information about a user')
    .addUserOption(option => option.setName('user').setDescription('The user to check').setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);

    const fields = [
      { name: 'Tag', value: user.tag, inline: true },
      { name: 'ID', value: `\`${user.id}\``, inline: true },
      { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:f> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`, inline: false }
    ];

    if (member) {
      fields.push(
        { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:f> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`, inline: false },
        { name: 'Highest Role', value: `<@&${member.roles.highest.id}>`, inline: true },
        { name: 'Roles Count', value: `${member.roles.cache.size - 1}`, inline: true }
      );
    }

    const embed = embeds.custom({
      title: `User Info - ${user.username}`,
      thumbnail: user.displayAvatarURL({ dynamic: true }),
      fields,
      color: '#5865F2'
    });

    await interaction.reply({ embeds: [embed] });
  }
};
