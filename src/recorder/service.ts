import { joinVoiceChannel } from '@discordjs/voice'
import { Injectable, Logger } from '@nestjs/common'
import {
  ChannelType,
  ChatInputCommandInteraction,
  Events,
  GatewayIntentBits,
  NonThreadGuildBasedChannel,
  PermissionFlagsBits,
  SlashCommandBuilder,
  VoiceState,
} from 'discord.js'
import { ClientService } from 'src/client/service'
import { Discordable } from 'src/discordable.util'
import { SessionEntity } from './session.entity'
import { SessionService } from './session.service'

@Injectable()
@Discordable({
  permissions: [
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.SendMessages,
  ],
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  commands: [
    new SlashCommandBuilder()
      .setName('record')
      .setDescription('Conversation recorder')
      .addSubcommand((c) =>
        c
          .setName('start')
          .setDescription("Record conversation if you're on a voice channel")
          .addStringOption((o) =>
            o
              .setName('transcription')
              .setDescription(
                'Generate a text file with a transcription of the session',
              )
              .setChoices(
                { name: 'Yes', value: 'yes' },
                { name: 'No', value: 'no' },
              ),
          ),
      )
      .addSubcommand((c) =>
        c.setName('stop').setDescription('Stop current recording session'),
      ),
  ],
})
export class RecorderService {
  private logger = new Logger(RecorderService.name)
  private sessions: Map<string, SessionEntity> = new Map()

  constructor(
    private client: ClientService,
    private sessionService: SessionService,
  ) {
    this.logger.log('Initialize recording service')
    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return
      if (interaction.commandName != 'record') return
      const subCommand = interaction.options.getSubcommand()

      await interaction.deferReply()

      const channels = await interaction.guild.channels.fetch()
      const channel = channels.find((channel) => {
        if (!(channel.type == ChannelType.GuildVoice)) return
        return channel.members.find(
          (member) => member.user.id == interaction.member.user.id,
        )
      })

      if (!channel) {
        interaction.editReply(
          'You must join a voice channel before using this command',
        )
        return
      }
      switch (subCommand) {
        case 'start':
          await this.startRecording(
            interaction,
            channel,
            interaction.options.getString('transcription') == 'yes',
          )
          break
        case 'stop': {
          const session = this.sessions.get(channel.id)
          if (!session) {
            interaction.editReply('No recording session found')
            return
          }
          await this.finalizeSession(interaction, session)
        }
      }
    })
  }

  async startRecording(
    interaction: ChatInputCommandInteraction,
    voiceChannel: NonThreadGuildBasedChannel,
    transcribe?: boolean,
  ) {
    if (voiceChannel.type != ChannelType.GuildVoice)
      throw new Error('Channel is not a voice channel')

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guildId,
      selfDeaf: false,
      selfMute: true,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    })

    const session = new SessionEntity(voiceChannel, connection)
    session.transcription = transcribe
    this.sessions.set(voiceChannel.id, session)
    connection.receiver.speaking.on('start', async (userId) => {
      this.sessionService.recordUser(connection.receiver, userId, session)
    })

    this.client.on('voiceStateUpdate', (oldState, newState) => {
      this.handleStateUpdate(
        voiceChannel.id,
        voiceChannel.members.size,
        interaction,
        session,
        oldState,
        newState,
      )
    })

    interaction.editReply('Starting recording')
  }

  async handleStateUpdate(
    channelId: string,
    memberCount: number,
    interaction: ChatInputCommandInteraction,
    session: SessionEntity,
    oldState: VoiceState,
    newState: VoiceState,
  ) {
    if (oldState.channelId == channelId && newState.channelId != channelId) {
      if (memberCount == 1) {
        // Everyone except the bot has left the channel
        await this.finalizeSession(interaction, session)
      }
    }
  }

  async finalizeSession(
    interaction: ChatInputCommandInteraction,
    session: SessionEntity,
  ) {
    try {
      const files = await this.sessionService.generateTracks(session)

      if (session.transcription) {
        const transcription =
          await this.sessionService.generateTranscription(session)
        files.push(transcription)
      }

      await interaction.editReply({ content: 'Record finished', files })
      this.sessionService.cleanSessionDir(session)
    } catch (e) {
      this.logger.error(`Error when generating tracks`)
      this.logger.error(e)
      await interaction.editReply(`Error when generating tracks`)
    }
    this.logger.debug('Leaving channel')
    session.connection?.destroy?.()
    session.connection = null
    this.sessions.delete(session.channel.id)
  }
}
