import { Injectable } from '@nestjs/common';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { EnvService } from 'src/config/env.service';

@Injectable()
export class ClientService {
  public client = new Client({ intents: [GatewayIntentBits.Guilds] });
  constructor(private env: EnvService) {
    this.connect();
  }

  connect() {
    this.client.once(Events.ClientReady, (c) => {
      console.log(`Ready! Logged in as ${c.user.tag}`);
    });
    this.client.login(this.env.DISCORD_TOKEN);
  }
}
