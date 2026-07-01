const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nickname')
    .setDescription('Changes or resets a member\'s nickname')
    .addUserOption(option => option.setName('user').setDescription('The user to nickname').setRequired(true))
    .addStringOption(option => option.setName('nickname').setDescription('The new nickname (leave blank to reset)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const nickname = interaction.options.getString('nickname');
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ embeds: [embeds.error('That user is not in this server!')], ephemeral: true });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ embeds: [embeds.error('You cannot change the nickname of a user with an equal or higher role than yours!')], ephemeral: true });
    }

    if (!member.manageable) {
      return interaction.reply({ embeds: [embeds.error('I cannot manage this user! Check my role hierarchy and permissions.')], ephemeral: true });
    }

    try {
      await member.setNickname(nickname);
      const successEmbed = embeds.success(
        nickname 
          ? `Changed nickname of **${user.tag}** to **${nickname}**.` 
          : `Reset nickname of **${user.tag}**.`
      );
      await interaction.reply({ embeds: [successEmbed] });
    } catch (err) {
      await interaction.reply({ embeds: [embeds.error(`Failed to change nickname: ${err.message}`)], ephemeral: true });
    }
  }
};
