const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embeds = require('../../utils/embeds');
const Giveaway = require('../../models/Giveaway');

// Simple duration parser helper
function parseDuration(str) {
  const num = parseInt(str, 10);
  if (isNaN(num)) return null;
  const unit = str.replace(num, '').trim().toLowerCase();
  
  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return num * 60 * 1000; // default to minutes
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Server giveaways administration')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new giveaway')
        .addStringOption(option => option.setName('duration').setDescription('Duration (e.g. 30s, 10m, 2h, 1d)').setRequired(true))
        .addIntegerOption(option => option.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1))
        .addStringOption(option => option.setName('prize').setDescription('Prize to win').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('Instantly ends a giveaway')
        .addStringOption(option => option.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reroll')
        .setDescription('Rerolls a finished giveaway for new winners')
        .addStringOption(option => option.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('pause')
        .setDescription('Pauses a giveaway')
        .addStringOption(option => option.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('resume')
        .setDescription('Resumes a paused giveaway')
        .addStringOption(option => option.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // --- Subcommand: Create ---
    if (subcommand === 'create') {
      const durationStr = interaction.options.getString('duration');
      const winnersCount = interaction.options.getInteger('winners');
      const prize = interaction.options.getString('prize');

      const ms = parseDuration(durationStr);
      if (!ms || ms < 5000) {
        return interaction.reply({ embeds: [embeds.error('Invalid duration format. Example: `10m`, `1h`, `1d` (min 5 seconds).')], ephemeral: true });
      }

      const endTime = new Date(Date.now() + ms);
      const endUnix = Math.floor(endTime.getTime() / 1000);

      const giveawayEmbed = embeds.custom({
        title: `🎉 GIVEAWAY: ${prize} 🎉`,
        description: `React with 🎉 to enter!\n\n**Ends:** <t:${endUnix}:F> (<t:${endUnix}:R>)\n**Hosted by:** <@${interaction.user.id}>\n**Winners:** ${winnersCount}\n**Entries:** 0`,
        color: '#EB459E'
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_enter_temp`)
          .setLabel('Join')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎉')
      );

      const giveawayMessage = await interaction.channel.send({ embeds: [giveawayEmbed], components: [row] });

      // Update button custom ID with real message ID
      row.components[0].setCustomId(`giveaway_enter_${giveawayMessage.id}`);
      await giveawayMessage.edit({ components: [row] });

      const giveawayDoc = new Giveaway({
        messageId: giveawayMessage.id,
        channelId: interaction.channel.id,
        guildId: interaction.guild.id,
        prize,
        winnerCount: winnersCount,
        endTime,
        hostedBy: interaction.user.id
      });
      await giveawayDoc.save();

      return interaction.reply({ content: 'Giveaway started successfully!', ephemeral: true });
    }

    // --- All other commands require a message ID validation ---
    const messageId = interaction.options.getString('message_id');
    const giveaway = await Giveaway.findOne({ guildId: interaction.guild.id, messageId });

    if (!giveaway) {
      return interaction.reply({ embeds: [embeds.error('Giveaway message ID not found in database.')], ephemeral: true });
    }

    // --- Subcommand: End ---
    if (subcommand === 'end') {
      if (giveaway.ended) {
        return interaction.reply({ embeds: [embeds.error('This giveaway has already ended.')], ephemeral: true });
      }

      // Force end date to now so ready.js interval processes it instantly
      giveaway.endTime = new Date();
      await giveaway.save();
      return interaction.reply({ embeds: [embeds.success('Giveaway ending process triggered!')] });
    }

    // --- Subcommand: Reroll ---
    if (subcommand === 'reroll') {
      if (!giveaway.ended) {
        return interaction.reply({ embeds: [embeds.error('This giveaway is still active! End it first.')], ephemeral: true });
      }

      const participants = giveaway.enteredUsers;
      if (participants.length === 0) {
        return interaction.reply({ embeds: [embeds.error('No participants to reroll from.')], ephemeral: true });
      }

      const winners = [];
      const tempUsers = [...participants];
      const actualWinnerCount = Math.min(giveaway.winnerCount, tempUsers.length);

      for (let i = 0; i < actualWinnerCount; i++) {
        const randomIndex = Math.floor(Math.random() * tempUsers.length);
        winners.push(tempUsers.splice(randomIndex, 1)[0]);
      }

      const winnerMentions = winners.map(w => `<@${w}>`).join(', ');
      
      try {
        const channel = await interaction.guild.channels.fetch(giveaway.channelId);
        if (channel) {
          await channel.send({
            content: `🎉 **GIVEAWAY REROLL** 🎉\nNew winners for **${giveaway.prize}**: ${winnerMentions}!`
          });
        }
      } catch (e) {}

      return interaction.reply({ embeds: [embeds.success(`Reroll completed. Winners: ${winnerMentions}`)] });
    }

    // --- Subcommand: Pause ---
    if (subcommand === 'pause') {
      if (giveaway.ended) {
        return interaction.reply({ embeds: [embeds.error('This giveaway has already ended.')], ephemeral: true });
      }
      if (giveaway.paused) {
        return interaction.reply({ embeds: [embeds.error('This giveaway is already paused.')], ephemeral: true });
      }

      giveaway.paused = true;
      await giveaway.save();

      // Edit interface
      try {
        const channel = await interaction.guild.channels.fetch(giveaway.channelId);
        const msg = await channel.messages.fetch(giveaway.messageId);
        const embed = msg.embeds[0];
        if (embed) {
          const updatedEmbed = {
            ...embed.toJSON(),
            description: `**PAUSED**\n${embed.description}`
          };
          await msg.edit({ embeds: [updatedEmbed] });
        }
      } catch (e) {}

      return interaction.reply({ embeds: [embeds.success('Giveaway paused successfully.')] });
    }

    // --- Subcommand: Resume ---
    if (subcommand === 'resume') {
      if (giveaway.ended) {
        return interaction.reply({ embeds: [embeds.error('This giveaway has already ended.')], ephemeral: true });
      }
      if (!giveaway.paused) {
        return interaction.reply({ embeds: [embeds.error('This giveaway is not paused.')], ephemeral: true });
      }

      giveaway.paused = false;
      await giveaway.save();

      // Edit interface
      try {
        const channel = await interaction.guild.channels.fetch(giveaway.channelId);
        const msg = await channel.messages.fetch(giveaway.messageId);
        const embed = msg.embeds[0];
        if (embed) {
          const updatedEmbed = {
            ...embed.toJSON(),
            description: embed.description.replace('**PAUSED**\n', '')
          };
          await msg.edit({ embeds: [updatedEmbed] });
        }
      } catch (e) {}

      return interaction.reply({ embeds: [embeds.success('Giveaway resumed successfully.')] });
    }
  }
};
