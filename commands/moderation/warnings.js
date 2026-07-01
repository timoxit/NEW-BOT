const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');
const Warning = require('../../models/Warning');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Lists or manages warnings for a user')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lists all warnings for a user')
        .addUserOption(option => option.setName('user').setDescription('The user to check warnings for').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('clear')
        .setDescription('Clears warnings for a user')
        .addUserOption(option => option.setName('user').setDescription('The user to clear warnings for').setRequired(true))
        .addIntegerOption(option => option.setName('warning_id').setDescription('Specify warning index/number to clear (leave blank to clear all)').setRequired(false))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');

    if (subcommand === 'list') {
      try {
        const warnings = await Warning.find({ guildId: interaction.guild.id, userId: user.id }).sort({ timestamp: -1 });

        if (warnings.length === 0) {
          return interaction.reply({ embeds: [embeds.info(`**${user.tag}** has no active warnings.`)] });
        }

        const fields = warnings.map((w, index) => {
          return {
            name: `Warning #${warnings.length - index}`,
            value: `**Reason:** ${w.reason}\n**Moderator:** <@${w.moderatorId}>\n**Date:** <t:${Math.floor(w.timestamp.getTime() / 1000)}:d> (<t:${Math.floor(w.timestamp.getTime() / 1000)}:R>)`
          };
        });

        const listEmbed = embeds.custom({
          title: `⚠️ Warnings for ${user.tag}`,
          description: `Total Warnings: **${warnings.length}**`,
          fields: fields.slice(0, 10), // Limit to 10 for embed size limits
          color: '#FEE75C'
        });

        await interaction.reply({ embeds: [listEmbed] });
      } catch (err) {
        await interaction.reply({ embeds: [embeds.error(`Failed to list warnings: ${err.message}`)], ephemeral: true });
      }
    } else if (subcommand === 'clear') {
      const warningIndex = interaction.options.getInteger('warning_id');
      try {
        const warnings = await Warning.find({ guildId: interaction.guild.id, userId: user.id }).sort({ timestamp: 1 });

        if (warnings.length === 0) {
          return interaction.reply({ embeds: [embeds.error(`**${user.tag}** has no warnings to clear.`)], ephemeral: true });
        }

        if (warningIndex !== null) {
          // Clear a specific warning
          const targetIndex = warningIndex - 1;
          if (targetIndex < 0 || targetIndex >= warnings.length) {
            return interaction.reply({ embeds: [embeds.error(`Invalid warning number. Choose a number between 1 and ${warnings.length}.`)], ephemeral: true });
          }

          const targetWarning = warnings[targetIndex];
          await Warning.deleteOne({ _id: targetWarning._id });

          const successEmbed = embeds.success(`Successfully cleared Warning #${warningIndex} for **${user.tag}**.`);
          await interaction.reply({ embeds: [successEmbed] });
        } else {
          // Clear all warnings
          await Warning.deleteMany({ guildId: interaction.guild.id, userId: user.id });
          const successEmbed = embeds.success(`Successfully cleared all warnings (${warnings.length}) for **${user.tag}**.`);
          await interaction.reply({ embeds: [successEmbed] });
        }
      } catch (err) {
        await interaction.reply({ embeds: [embeds.error(`Failed to clear warnings: ${err.message}`)], ephemeral: true });
      }
    }
  }
};
