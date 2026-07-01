const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const embeds = require('../../utils/embeds');
const backupHelper = require('../../utils/backupHelper');
const Backup = require('../../models/Backup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Server configuration backup administration')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Creates a backup of the current server roles and channels')
        .addStringOption(option => option.setName('name').setDescription('A name to identify this backup').setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lists all backups for this server')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Deletes a server backup')
        .addStringOption(option => option.setName('backup_id').setDescription('The ID of the backup').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('restore')
        .setDescription('Restores the server roles and channels (destructive!)')
        .addStringOption(option => option.setName('backup_id').setDescription('The ID of the backup to restore').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // --- Subcommand: Create ---
    if (subcommand === 'create') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const name = interaction.options.getString('name');
        const backupDoc = await backupHelper.createBackup(interaction.guild, interaction.user.id, name);

        const successEmbed = embeds.success(
          `Backup created successfully!\n\n**Backup ID:** \`${backupDoc.backupId}\`\n**Name:** ${backupDoc.name}\n` +
          `**Created At:** <t:${Math.floor(backupDoc.createdAt.getTime() / 1000)}:f>\n` +
          `**Data Size:** ${backupDoc.data.channels.length} channels, ${backupDoc.data.roles.length} roles`
        );
        return interaction.editReply({ embeds: [successEmbed] });
      } catch (err) {
        return interaction.editReply({ embeds: [embeds.error(`Failed to create backup: ${err.message}`)] });
      }
    }

    // --- Subcommand: List ---
    if (subcommand === 'list') {
      try {
        const backups = await Backup.find({ guildId: interaction.guild.id }).sort({ createdAt: -1 });

        if (backups.length === 0) {
          return interaction.reply({ embeds: [embeds.info('There are no backups saved for this server.')] });
        }

        const lines = backups.map(b => {
          return `🔹 ID: \`${b.backupId}\` • **${b.name}** (<t:${Math.floor(b.createdAt.getTime() / 1000)}:R>)`;
        });

        const listEmbed = embeds.info(lines.join('\n'), '💾 Saved Backups');
        return interaction.reply({ embeds: [listEmbed] });
      } catch (err) {
        return interaction.reply({ embeds: [embeds.error(`Failed to retrieve backups: ${err.message}`)], ephemeral: true });
      }
    }

    // --- Subcommand: Delete ---
    if (subcommand === 'delete') {
      const backupId = interaction.options.getString('backup_id').toUpperCase();
      try {
        const result = await Backup.deleteOne({ guildId: interaction.guild.id, backupId });

        if (result.deletedCount === 0) {
          return interaction.reply({ embeds: [embeds.error(`Backup ID \`${backupId}\` not found for this server.`)], ephemeral: true });
        }

        return interaction.reply({ embeds: [embeds.success(`Backup \`${backupId}\` deleted successfully.`)] });
      } catch (err) {
        return interaction.reply({ embeds: [embeds.error(`Failed to delete backup: ${err.message}`)], ephemeral: true });
      }
    }

    // --- Subcommand: Restore ---
    if (subcommand === 'restore') {
      const backupId = interaction.options.getString('backup_id').toUpperCase();
      const backupDoc = await Backup.findOne({ guildId: interaction.guild.id, backupId });

      if (!backupDoc) {
        return interaction.reply({ embeds: [embeds.error(`Backup ID \`${backupId}\` not found.`)], ephemeral: true });
      }

      // Construct a confirmation panel
      const warningEmbed = embeds.custom({
        title: '⚠️ CRITICAL WARNING: DESTRUCTIVE RESTORE',
        description: 'You are about to restore a server configuration backup. This operation is **extremely destructive**:\n\n' +
          '• **All current text/voice channels and categories will be deleted** (except this active channel temporarily).\n' +
          '• **All current roles will be deleted** (except bot integration roles).\n' +
          '• Server layout, settings, and permissions will be reconstructed from the backup.\n\n' +
          'Click **Confirm Restore** below to proceed or **Cancel** to abort.',
        color: '#ED4245'
      });

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_restore').setLabel('Confirm Restore').setStyle(ButtonStyle.Danger).setEmoji('🚨'),
        new ButtonBuilder().setCustomId('cancel_restore').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      );

      const promptMsg = await interaction.reply({
        embeds: [warningEmbed],
        components: [confirmRow],
        ephemeral: true,
        fetchReply: true
      });

      // Collector to wait for selection
      const collector = promptMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000 // 30 seconds to decide
      });

      collector.on('collect', async btnInteraction => {
        if (btnInteraction.customId === 'cancel_restore') {
          await btnInteraction.update({
            content: '❌ Restoration aborted by operator.',
            embeds: [],
            components: []
          });
          collector.stop();
          return;
        }

        if (btnInteraction.customId === 'confirm_restore') {
          // Defer update to show loading
          await btnInteraction.update({
            content: '⏳ Starting restoration... The server structure is being rebuilt. Please wait...',
            embeds: [],
            components: []
          });

          collector.stop();

          try {
            // Keep track of the active channel to post progress and delete it at the end
            await backupHelper.restoreBackup(interaction.guild, backupDoc.data, interaction.channel);
          } catch (e) {
            console.error('Error during restoration process:', e);
          }
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.editReply({
            content: '❌ Restoration timed out. Aborted.',
            embeds: [],
            components: []
          }).catch(() => {});
        }
      });
    }
  }
};
