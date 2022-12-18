import { Injectable } from '@nestjs/common'
import {
  GatewayIntentBits,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js'
import { Discordable } from 'src/discord.service'

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
      .addSubcommand((command) =>
        command.setName('create').setDescription('Create a new poll'),
      )
      .addSubcommand((command) => command.setName('addResponse')),
  ],
})
export class PollService {
  polls: Record<string, { title: string; choices: string[] }> = {}
}
