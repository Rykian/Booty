import { Injectable } from '@nestjs/common'
import {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  PermissionsBitField,
  Routes,
} from 'discord.js'
import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { EnvService } from 'src/config/env.service'
import {
  commands,
  Discordable,
  intents,
  permissions,
} from 'src/discord.service'

@Injectable()
@Discordable({
  intents: [GatewayIntentBits.Guilds],
})
export class ClientService extends Client {
  constructor(private env: EnvService) {
    super({ intents: [...intents] })
    const arrayPermissions = Array.from(permissions)
    console.log(
      `Permissions needed (${new PermissionsBitField(
        arrayPermissions,
      ).bitfield.toString()}):`,
      arrayPermissions
        .map((p) =>
          Object.entries(PermissionFlagsBits).find(([_name, value]) => {
            if (value == p) return true
          }),
        )
        .map(([name]) => name)
        .join(', '),
    )

    this.connect().then(() => this.handleCommandPush())
  }

  async connect() {
    this.once(Events.ClientReady, (c) => {
      console.log(`Ready! Logged in as ${c.user.tag}`)
    })
    await this.login(this.env.DISCORD_TOKEN)
  }

  async handleCommandPush() {
    const commandFile = 'node_modules/commands.json'
    const commandsToString = JSON.stringify(
      commands.map((command) => command.toJSON()),
    )
    if (existsSync(commandFile)) {
      if ((await readFile(commandFile)).toString() == commandsToString) {
        console.log('Commands seems up-to-date!')
        return
      }
    }
    await this.rest.put(
      Routes.applicationCommands(this.env.DISCORD_CLIENT_ID),
      {
        body: commands.map((command) => command.toJSON()),
      },
    )
    console.log('Commands updated!')
    await writeFile(commandFile, commandsToString)
  }
}
