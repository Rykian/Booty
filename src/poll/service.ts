import { Injectable } from '@nestjs/common'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import { ClientService } from 'src/client/service'
import { Discordable } from 'src/discordable.util'
import * as R from 'remeda'
import { Poll } from './poll.entity'
import { Choice } from './choices.entity'
import { Answer } from './answer.entity'
import { FindOptions } from 'sequelize'

@Injectable()
@Discordable({
  permissions: [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
  ],
  intents: [
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
  ],
  commands: [
    new SlashCommandBuilder()
      .setName('poll')
      .setDescription('Manage polls')
      .addSubcommand((c) =>
        c.setName('create').setDescription('Create a new poll'),
      ),
  ],
})
export class PollService {
  constructor(
    private client: ClientService, // private sequelize: Sequelize,
  ) {
    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return
      if (interaction.commandName != 'poll') return

      switch (interaction.options.getSubcommand()) {
        case 'create': {
          const modal = this.createPollModal()
          await interaction.showModal(modal)
          break
        }
      }
    })

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isModalSubmit()) return
      if (interaction.customId != 'poll') return

      const message = await interaction.reply('Creating poll...')
      const title = interaction.fields.getTextInputValue('title')
      const options: string[] = interaction.fields
        .getTextInputValue('options')
        .split('\n')

      const poll = await this.createPoll(message.id, title, options)
      const embed = await this.generateEmbed(poll)

      const rows = R.pipe(
        poll.choices,
        R.map((choice) => choice.title),
        R.chunk(5),
        R.map((chunk) =>
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            chunk.map((option) =>
              new ButtonBuilder()
                .setCustomId(`polls/${poll.id}/${option}`)
                .setLabel(option)
                .setStyle(ButtonStyle.Primary),
            ),
          ),
        ),
      )

      await interaction.editReply({
        content: '',
        embeds: [embed],
        components: rows,
      })
    })

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton()) return

      const match = interaction.customId.match(
        /^polls\/(?<messageId>.*)\/(?<answer>.*)$/,
      )
      if (!match) return

      const messageId = match.groups['messageId']
      const choiceTitle = match.groups['answer']

      const updatedPoll = await this.vote(
        messageId,
        choiceTitle,
        interaction.user.id,
      )

      interaction.reply({ ephemeral: true, content: 'You toggled!' })
      await interaction.message.edit({
        embeds: [await this.generateEmbed(updatedPoll)],
      })
    })
  }

  async generateEmbed(poll: Poll) {
    const fields = poll.choices.map((choice) => {
      const users = choice.answers?.map((answer) => `<@${answer.userId}>`) || []

      return {
        inline: true,
        name: `${choice.title} *(${users.length})*`,
        value: users.length ? users.join('\n') : '-',
      }
    })

    const embed = new EmbedBuilder().setTitle(poll.title).addFields(fields)

    return embed
  }

  createPollModal() {
    const modal = new ModalBuilder().setCustomId('poll').setTitle('New poll')

    const title = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Title')
      .setStyle(TextInputStyle.Short)

    const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
      title,
    )
    modal.addComponents(firstRow)

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(`options`)
          .setLabel(`Options`)
          .setPlaceholder('1 per line')
          .setStyle(TextInputStyle.Paragraph),
      ),
    )
    return modal
  }

  async createPoll(id: string, title: string, options: string[]) {
    const poll = await Poll.create({ id, title })
    poll.choices = await R.pipe(
      options,
      R.map((title) => Choice.create({ title, pollId: poll.id })),
      (x) => Promise.all(x),
    )

    return poll
  }

  async vote(messageId: string, answer: string, userId: string) {
    const query: FindOptions<Poll> = {
      where: { id: messageId },
      include: [{ all: true, nested: true }],
    }
    const poll = await Poll.findOne(query)
    const choice = poll.choices.find((choice) => choice.title == answer)

    const existingAnswer = choice.answers?.find(
      (answer) => answer.userId == userId,
    )

    if (existingAnswer) {
      await existingAnswer.destroy()
    } else {
      await Answer.create({
        pollId: messageId,
        choiceId: choice.id,
        userId,
      })
    }

    // TODO: why poll.reload() doesn't work?
    return Poll.findOne(query)
  }
}
