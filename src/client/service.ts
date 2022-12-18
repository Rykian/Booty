import { Injectable } from '@nestjs/common';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { EnvService } from 'src/config/env.service';

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMessageReactions,
];

@Injectable()
export class ClientService extends Client {
  constructor(private env: EnvService) {
    super({ intents });
    this.connect();
  }

  connect() {
    this.once(Events.ClientReady, (c) => {
      console.log(`Ready! Logged in as ${c.user.tag}`);
    });
    this.login(this.env.DISCORD_TOKEN);
  }
}
