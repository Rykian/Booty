import { VoiceConnection, joinVoiceChannel } from '@discordjs/voice'
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
import { Discordable } from 'src/discord.service'
import { SessionEntity } from './session.entity'
import { SessionService } from './session.service'
import { unlink } from 'fs/promises'

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
      .setDescription("Record conversation if you're on a voice channel"),
  ],
})
export class RecorderService {
  private logger = new Logger(RecorderService.name)

  constructor(
    private client: ClientService,
    private sessionService: SessionService,
  ) {
    this.logger.log('Initialize recording service')
    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return
      if (interaction.commandName != 'record') return

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
      } else {
        await this.startRecording(interaction, channel)
      }
    })
  }

  async startRecording(
    interaction: ChatInputCommandInteraction,
    voiceChannel: NonThreadGuildBasedChannel,
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

    const session = new SessionEntity(voiceChannel)

    connection.receiver.speaking.on('start', async (userId) => {
      this.sessionService.recordUser(connection.receiver, userId, session)
    })

    this.client.on('voiceStateUpdate', (oldState, newState) => {
      this.handleStateUpdate(
        voiceChannel.id,
        voiceChannel.members.size,
        interaction,
        connection,
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
    connection: VoiceConnection,
    session: SessionEntity,
    oldState: VoiceState,
    newState: VoiceState,
  ) {
    if (oldState.channelId == channelId && newState.channelId != channelId) {
      if (memberCount == 1) {
        // Everyone except the bot has left the channel
        await this.finalizeSession(interaction, session)
        this.logger.debug('Leaving channel')
        connection.destroy()
      }
    }
  }

  async finalizeSession(
    interaction: ChatInputCommandInteraction,
    session: SessionEntity,
  ) {
    try {
      const files = await this.sessionService.generateTracks(session)
      await interaction.editReply({ content: 'Record finished', files })
      this.logger.debug('Cleanup track files')
      const deletions = files.map((file) => unlink(file))
      await Promise.all(deletions)
      this.logger.debug('Track files removed')
    } catch (e) {
      this.logger.error(`Error when generating tracks`)
      this.logger.error(e)
      await interaction.editReply(`Error when generating tracks`)
    }
  }
}
