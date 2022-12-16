import { Module } from '@nestjs/common';
import { ClientModule } from 'src/client/module';
import { ConfigModule } from 'src/config/module';
import { MusicService } from './service';

@Module({
  imports: [ConfigModule, ClientModule],
  providers: [MusicService],
})
export class MusicModule {}
