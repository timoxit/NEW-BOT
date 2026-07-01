const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Manages user roles')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Adds a role to a member')
        .addUserOption(option => option.setName('user').setDescription('The user to manage').setRequired(true))
        .addRoleOption(option => option.setName('role').setDescription('The role to add').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Removes a role from a member')
        .addUserOption(option => option.setName('user').setDescription('The user to manage').setRequired(true))
        .addRoleOption(option => option.setName('role').setDescription('The role to remove').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ embeds: [embeds.error('That user is not in this server!')], ephemeral: true });
    }

    // Role hierarchy check for moderator
    if (role.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ embeds: [embeds.error('You cannot manage a role that is equal to or higher than your highest role!')], ephemeral: true });
    }

    // Role hierarchy check for bot
    const botMember = interaction.guild.members.me;
    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({ embeds: [embeds.error('I cannot manage this role because it is higher than or equal to my highest role!')], ephemeral: true });
    }

    try {
      if (subcommand === 'add') {
        if (member.roles.cache.has(role.id)) {
          return interaction.reply({ embeds: [embeds.error(`**${user.tag}** already has the **${role.name}** role!`)], ephemeral: true });
        }
        await member.roles.add(role);
        await interaction.reply({ embeds: [embeds.success(`Added the **${role.name}** role to **${user.tag}**.`)] });
      } else if (subcommand === 'remove') {
        if (!member.roles.cache.has(role.id)) {
          return interaction.reply({ embeds: [embeds.error(`**${user.tag}** does not have the **${role.name}** role!`)], ephemeral: true });
        }
        await member.roles.remove(role);
        await interaction.reply({ embeds: [embeds.success(`Removed the **${role.name}** role from **${user.tag}**.`)] });
      }
    } catch (err) {
      await interaction.reply({ embeds: [embeds.error(`Failed to modify roles: ${err.message}`)], ephemeral: true });
    }
  }
};
