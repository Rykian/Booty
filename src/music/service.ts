import { Injectable } from '@nestjs/common'
import {
  ChannelType,
  ChatInputCommandInteraction,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  Routes,
  SlashCommandBuilder,
  User,
  VoiceChannel,
} from 'discord.js'
import { ClientService } from 'src/client/service'
import { EnvService } from 'src/config/env.service'
import { DefaultQueue, Player, SearchResult, Vulkava } from 'vulkava'

@Injectable()
export class MusicService {
  static permissions = [
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.SendMessages,
  ]
  static intents = [GatewayIntentBits.GuildMessageReactions]
  private vulkava: Vulkava
  private players: { [guildId: string]: { [voiceChannel: string]: Player } } =
    {}

  constructor(private env: EnvService, private client: ClientService) {
    this.initLavalinkClient()
    const COMMAND = new SlashCommandBuilder()
      .setName('music')
      .setDescription('Plays music')
      .addSubcommand((command) =>
        command
          .setName('add')
          .setDescription('Add a track to queue')
          .addStringOption((option) =>
            option
              .setRequired(true)
              .setName('track')
              .setDescription(
                'YouTube or Spotify track URL, or YouTube search',
              ),
          ),
      )
      .addSubcommand((command) =>
        command.setName('pause').setDescription('Pause the music'),
      )
      .addSubcommand((command) =>
        command.setName('skip').setDescription('Skip current track'),
      )
      .addSubcommand((command) =>
        command
          .setName('stop')
          .setDescription('Stop and disconnect bot from voice channel'),
      )
      .addSubcommand((command) =>
        command.setName('resume').setDescription('Resume play'),
      )
      .addSubcommand((command) =>
        command.setName('shuffle').setDescription('Shuffle the queue'),
      )
      .addSubcommand((command) =>
        command
          .setName('volume')
          .setDescription('Set the volume')
          .addIntegerOption((option) =>
            option
              .setName('amount')
              .setDescription(
                `Volume amount (between 0 to 10). Default: ${this.env.MUSIC_DEFAULT_VOLUME}`,
              )
              .setMinValue(0)
              .setMaxValue(10),
          ),
      )
    const commands = [COMMAND]

    this.client.rest
      .put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
        body: commands.map((command) => command.toJSON()),
      })
      .then(() => console.log('Commands updated!'))

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return

      await interaction.deferReply({ ephemeral: true })
      this.joinUserVoiceChannel(interaction)
    })
  }

  async joinUserVoiceChannel(interaction: ChatInputCommandInteraction) {
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

    // Creates the audio player
    const player = this.createOrGetPlayer(
      interaction.guild.id,
      channel.id,
      interaction.channelId,
    )

    switch (interaction.options.getSubcommand()) {
      case 'add':
        this.addTrack(interaction, player)
        break
      case 'skip':
        player.skip()
        break
      case 'pause':
        player.pause()
        break
      case 'stop':
        this.stop(player)
        break
      case 'resume':
        if (!player.play) player.play()
        break
      case 'shuffle':
        ;(player.queue as DefaultQueue).shuffle()
        break
      case 'volume':
        const amount =
          (interaction.options.get('amount')?.value as number | undefined) ||
          this.env.MUSIC_DEFAULT_VOLUME
        player.filters.setVolume(amount * 10)
        interaction.editReply(`Volume set to ${amount}`)
      default:
        console.log('No subcommand?')
    }
  }

  async stop(player: Player) {
    player.disconnect()
    this.players[player.guildId][player.voiceChannelId] = undefined
  }

  async addTrack(interaction: ChatInputCommandInteraction, player: Player) {
    const track = interaction.options.getString('track')

    const result = await this.searchAndQueue(interaction.user, player, track)
    interaction.editReply(this.loadTypeToString(result))

    if (!player.playing) player.play()
  }

  async searchAndQueue(user: User, player: Player, search: string) {
    const res = await this.vulkava.search(search)

    switch (res.loadType) {
      case 'PLAYLIST_LOADED':
        for (const track of res.tracks) {
          track.setRequester(user)
          await player.queue.add(track)
        }
      case 'TRACK_LOADED':
        const track = res.tracks[0]
        track.setRequester(user)
        await player.queue.add(track)
    }

    return res
  }

  loadTypeToString(res: SearchResult) {
    switch (res.loadType) {
      case 'LOAD_FAILED':
        return `:x: Load failed: ${res.exception.message}`
      case 'NO_MATCHES':
        return ':x: No matches'
      case 'PLAYLIST_LOADED':
        return `Playlist \`${res.playlistInfo.name}\` loaded!`
      default:
        const track = res.tracks[0]
        return `Queued \`${track.title}\``
    }
  }

  createOrGetPlayer(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string,
  ) {
    const player = this.players[guildId]?.[voiceChannelId]
    if (player) return player

    console.log({ guildId, voiceChannelId, textChannelId })

    const newPlayer = this.vulkava.createPlayer({
      guildId,
      voiceChannelId,
      textChannelId,
      selfDeaf: true,
    })
    this.players[guildId] ||= {}
    this.players[guildId][voiceChannelId] = newPlayer

    newPlayer.connect()
    newPlayer.filters.setVolume(this.env.MUSIC_DEFAULT_VOLUME * 10)
    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.id == this.client.user.id) return
      if (message.channelId != textChannelId) return
      if (!message.content.match('^https://(open.spotify.com|(www.)youtu)'))
        return

      const response = await this.searchAndQueue(
        message.author,
        newPlayer,
        message.content,
      )
      if (['NO_MATCHES', 'LOAD_FAILED'].includes(response.loadType))
        message.react('❌')
      else message.react('🎵')
    })
    return newPlayer
  }

  async initLavalinkClient() {
    this.vulkava = new Vulkava({
      nodes: [
        {
          id: 'localhost',
          hostname: 'localhost',
          port: 2333,
          password: 'youshallnotpass',
        },
      ],
      sendWS: (guildId, payload) =>
        this.client.guilds.cache.get(guildId)?.shard.send(payload),
    })

    this.vulkava.on('error', (node, err) => {
      console.error(`[Vulkava] Error on node ${node.identifier}`, err.message)
    })

    this.client.on('ready', () => {
      // Starts the vulkava & connects to all lavalink nodes
      this.vulkava.start(this.client.user.id)
    })

    this.vulkava.on('trackStart', async (player, track) => {
      if (!player.textChannelId) return
      const guild = await this.client.guilds.fetch(player.guildId)
      const channel = (await guild.channels.fetch(
        player.voiceChannelId,
      )) as VoiceChannel
      channel.send(`Playing ${track.title}`)
    })

    this.vulkava.on('queueEnd', (player) => this.stop(player))

    this.client.on('raw', (packet) => this.vulkava.handleVoiceUpdate(packet))
  }
}
