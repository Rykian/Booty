import { Injectable } from '@nestjs/common';
import {
  ChannelType,
  ChatInputCommandInteraction,
  Events,
  Routes,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { ClientService } from 'src/client/service';
import { EnvService } from 'src/config/env.service';
import { DefaultQueue, Player, Vulkava } from 'vulkava';

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
          .setDescription('YouTube or Spotify track URL, or YouTube search'),
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
  );

@Injectable()
export class MusicService {
  private vulkava: Vulkava;
  private players: { [guildId: string]: { [voiceChannel: string]: Player } } =
    {};

  constructor(private env: EnvService, private client: ClientService) {
    this.initLavalinkClient();
    const commands = [COMMAND];

    this.client.rest
      .put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
        body: commands.map((command) => command.toJSON()),
      })
      .then(() => console.log('Commands updated!'));

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      this.joinUserVoiceChannel(interaction);
      interaction.reply({ content: 'Aknowledged', ephemeral: true });
    });
  }

  async joinUserVoiceChannel(interaction: ChatInputCommandInteraction) {
    const channels = await interaction.guild.channels.fetch();
    const channel = channels.find((channel) => {
      if (!(channel.type == ChannelType.GuildVoice)) return;
      return channel.members.find(
        (member) => member.user.id == interaction.member.user.id,
      );
    });

    if (!channel) {
      interaction.editReply(
        'You must join a voice channel before using this command',
      );
      return;
    }

    // Creates the audio player
    const player = this.createOrGetPlayer(
      interaction.guild.id,
      channel.id,
      interaction.channelId,
    );

    switch (interaction.options.getSubcommand()) {
      case 'add':
        this.addTrack(interaction, player);
        break;
      case 'skip':
        player.skip();
        break;
      case 'pause':
        player.pause();
        break;
      case 'stop':
        this.stop(player);
        break;
      case 'resume':
        if (!player.play) player.play();
        break;
      case 'shuffle':
        (player.queue as DefaultQueue).shuffle();
        break;
      default:
        console.log('No subcommand?');
    }
  }

  async stop(player: Player) {
    player.disconnect();
    this.players[player.guildId][player.voiceChannelId] = undefined;
  }

  async addTrack(interaction: ChatInputCommandInteraction, player: Player) {
    const track = interaction.options.getString('track');

    const res = await this.vulkava.search(track);

    if (res.loadType === 'LOAD_FAILED') {
      return interaction.editReply(
        `:x: Load failed. Error: ${res.exception.message}`,
      );
    } else if (res.loadType === 'NO_MATCHES') {
      return interaction.editReply(':x: No matches!');
    }

    if (res.loadType === 'PLAYLIST_LOADED') {
      for (const track of res.tracks) {
        track.setRequester(interaction.user);
        player.queue.add(track);
      }

      interaction.editReply(`Playlist \`${res.playlistInfo.name}\` loaded!`);
    } else {
      const track = res.tracks[0];
      track.setRequester(interaction.user);

      player.queue.add(track);
      interaction.editReply(`Queued \`${track.title}\``);
    }

    if (!player.playing) player.play();
  }

  createOrGetPlayer(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string,
  ) {
    const player = this.players[guildId]?.[voiceChannelId];
    if (player) return player;

    console.log({ guildId, voiceChannelId, textChannelId });

    const newPlayer = this.vulkava.createPlayer({
      guildId,
      voiceChannelId,
      textChannelId,
      selfDeaf: true,
    });
    this.players[guildId] ||= {};
    this.players[guildId][voiceChannelId] = newPlayer;

    newPlayer.connect();
    return newPlayer;
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
    });

    this.vulkava.on('error', (node, err) => {
      console.error(`[Vulkava] Error on node ${node.identifier}`, err.message);
    });

    this.client.on('ready', () => {
      // Starts the vulkava & connects to all lavalink nodes
      this.vulkava.start(this.client.user.id);
    });

    this.vulkava.on('trackStart', async (player, track) => {
      if (!player.textChannelId) return;
      const guild = await this.client.guilds.fetch(player.guildId);
      const channel = (await guild.channels.fetch(
        player.textChannelId,
      )) as TextChannel;
      channel.send(`Playing ${track.title}`);
    });

    this.vulkava.on('queueEnd', (player) => this.stop(player));

    this.client.on('raw', (packet) => this.vulkava.handleVoiceUpdate(packet));
  }
}
