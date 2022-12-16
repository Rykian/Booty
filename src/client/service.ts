import { Injectable } from '@nestjs/common';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { EnvService } from 'src/config/env.service';

@Injectable()
export class ClientService extends Client {
  constructor(private env: EnvService) {
    super({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
    });
    this.connect();
  }

  connect() {
    this.once(Events.ClientReady, (c) => {
      console.log(`Ready! Logged in as ${c.user.tag}`);
    });
    this.login(this.env.DISCORD_TOKEN);
  }
}
