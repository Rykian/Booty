import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientModule } from './client/module';
import { MusicModule } from './music/module';

@Module({
  imports: [ClientModule, MusicModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
