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
import { Discordable } from 'src/discord.service'
import { RedisService } from 'src/redis/service'
import * as R from 'remeda'
import { Poll } from './poll.entity'
import { Choice } from './choices.entity'
import { Sequelize } from 'sequelize-typescript'
import { Answer } from './answer.entity'

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
    private client: ClientService,
    private redis: RedisService,
    private sequelize: Sequelize,
  ) {
    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return
      if (interaction.commandName != 'poll') return

      switch (interaction.options.getSubcommand()) {
        case 'create':
          const modal = new ModalBuilder()
            .setCustomId('poll')
            .setTitle('New poll')

          const title = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)

          const firstRow =
            new ActionRowBuilder<TextInputBuilder>().addComponents(title)
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

          await interaction.showModal(modal)
          break
      }
    })

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isModalSubmit()) return
      if (interaction.customId != 'poll') return

      const title = interaction.fields.getTextInputValue('title')
      const options: string[] = interaction.fields
        .getTextInputValue('options')
        .split('\n')

      const poll = new Poll({
        title,
      })
      poll.choices = options.map((title) => new Choice({ title }))
      console.log(poll.choices)
      const embed = await this.generateEmbed(poll)

      const message = await interaction.reply({
        embeds: [embed],
      })

      poll.id = message.id

      const rows = R.pipe(
        options,
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
        components: rows,
      })
      console.log('Saving...')
      const { id: pollId } = await poll.save()
      await Promise.all(
        poll.choices.map((choice) => {
          choice.pollId = pollId
          return choice.save()
        }),
      )
      console.log('Saved.')
    })

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton()) return

      const match = interaction.customId.match(
        /^polls\/(?<messageId>.*)\/(?<answer>.*)$/,
      )
      if (!match) return

      const messageId = match.groups['messageId']
      const choiceTitle = match.groups['answer']

      const poll = await Poll.findOne({
        where: { id: messageId },
        include: [{ all: true, nested: true }],
      })

      const choice = poll.choices.find((choice) => choice.title == choiceTitle)

      console.log({ answers: choice.answers })
      const existingAnswer = choice.answers?.find((answer) => {
        console.log({
          'answer.userId': answer.userId,
          'interaction.user.id': interaction.user.id,
        })
        return answer.userId == interaction.user.id
      })

      if (existingAnswer) {
        await existingAnswer.destroy()
      } else {
        await Answer.create({
          pollId: messageId,
          choiceId: choice.id,
          userId: interaction.user.id,
        })
      }
      const updatedPoll = await Poll.findOne({
        where: { id: messageId },
        include: [{ all: true, nested: true }],
      })

      interaction.reply({ ephemeral: true, content: 'You toggled!' })
      await interaction.message.edit({
        embeds: [await this.generateEmbed(updatedPoll)],
      })
    })
  }

  async generateEmbed(poll: Poll) {
    const fields = poll.choices.map((choice) => {
      console.log({ choice }, choice.answers)
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
}
