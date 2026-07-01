const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Displays information about a role')
    .addRoleOption(option => option.setName('role').setDescription('The role to check').setRequired(true)),

  async execute(interaction) {
    const role = interaction.options.getRole('role');

    const fields = [
      { name: 'Role Name', value: role.name, inline: true },
      { name: 'ID', value: `\`${role.id}\``, inline: true },
      { name: 'Position', value: `${role.position}`, inline: true },
      { name: 'Color', value: `\`${role.hexColor}\``, inline: true },
      { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
      { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true }
    ];

    const embed = embeds.custom({
      title: `Role Info - ${role.name}`,
      fields,
      color: role.hexColor === '#000000' ? '#5865F2' : role.hexColor
    });

    await interaction.reply({ embeds: [embed] });
  }
};
