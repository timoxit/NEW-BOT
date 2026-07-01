const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');
const Guild = require('../../models/Guild');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Configuration for the leveling system')
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enables the leveling system')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disables the leveling system')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('rewards')
        .setDescription('Manage level role rewards')
        .addStringOption(option => 
          option.setName('action')
            .setDescription('Select action')
            .setRequired(true)
            .addChoices(
              { name: 'Add Reward', value: 'add' },
              { name: 'Remove Reward', value: 'remove' },
              { name: 'List Rewards', value: 'list' }
            )
        )
        .addIntegerOption(option => option.setName('level').setDescription('Level threshold (not required for list)').setRequired(false))
        .addRoleOption(option => option.setName('role').setDescription('Role to award (required for add)').setRequired(false))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    let settings = await Guild.findOne({ guildId: interaction.guild.id });
    if (!settings) {
      settings = new Guild({ guildId: interaction.guild.id });
    }

    if (subcommand === 'enable') {
      settings.levels.enabled = true;
      await settings.save();
      return interaction.reply({ embeds: [embeds.success('Leveling system enabled successfully!')] });
    }

    if (subcommand === 'disable') {
      settings.levels.enabled = false;
      await settings.save();
      return interaction.reply({ embeds: [embeds.success('Leveling system has been disabled.')] });
    }

    if (!settings.levels.enabled && subcommand !== 'enable') {
      return interaction.reply({ embeds: [embeds.error('Leveling system is disabled. Enable it with `/level enable`.')], ephemeral: true });
    }

    // --- Subcommand: Rewards ---
    if (subcommand === 'rewards') {
      const action = interaction.options.getString('action');
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');

      if (action === 'list') {
        const rewards = settings.levels.rewards;
        if (rewards.length === 0) {
          return interaction.reply({ embeds: [embeds.info('There are no level rewards configured.')] });
        }
        
        // Sort rewards by level
        rewards.sort((a, b) => a.level - b.level);

        const list = rewards.map(r => `Level **${r.level}**: <@&${r.roleId}>`).join('\n');
        return interaction.reply({ embeds: [embeds.info(list, '🏆 Level Role Rewards')] });
      }

      if (action === 'add') {
        if (!level || !role) {
          return interaction.reply({ embeds: [embeds.error('You must specify both level and role for the "add" action.')], ephemeral: true });
        }

        // Check if level reward already exists
        const existingIdx = settings.levels.rewards.findIndex(r => r.level === level);
        if (existingIdx !== -1) {
          settings.levels.rewards[existingIdx].roleId = role.id;
        } else {
          settings.levels.rewards.push({ level, roleId: role.id });
        }
        await settings.save();

        return interaction.reply({ embeds: [embeds.success(`Successfully added reward: **Level ${level}** award **${role.name}**.`)] });
      }

      if (action === 'remove') {
        if (!level) {
          return interaction.reply({ embeds: [embeds.error('You must specify the level for the "remove" action.')], ephemeral: true });
        }

        const initialLength = settings.levels.rewards.length;
        settings.levels.rewards = settings.levels.rewards.filter(r => r.level !== level);
        await settings.save();

        if (settings.levels.rewards.length === initialLength) {
          return interaction.reply({ embeds: [embeds.error(`No reward was configured for Level ${level}.`)], ephemeral: true });
        }

        return interaction.reply({ embeds: [embeds.success(`Successfully removed level reward for Level ${level}.`)] });
      }
    }
  }
};
