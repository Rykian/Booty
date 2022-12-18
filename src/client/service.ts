import { Injectable } from '@nestjs/common'
import {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  PermissionsBitField,
} from 'discord.js'
import { EnvService } from 'src/config/env.service'
import { Discordable, intents, permissions } from 'src/discord.service'

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

    this.connect()
  }

  connect() {
    this.once(Events.ClientReady, (c) => {
      console.log(`Ready! Logged in as ${c.user.tag}`)
    })
    this.login(this.env.DISCORD_TOKEN)
  }
}
