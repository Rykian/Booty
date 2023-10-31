import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ClientModule } from './client/module'
import { MusicModule } from './music/module'
import { PollModule } from './poll/module'
import { RedisModule } from './redis/module'
import { RecorderModule } from './recorder/module'
import { sequelizeForRoot } from './database.util'


@Module({
  imports: [
    sequelizeForRoot(),
    ClientModule,
    MusicModule,
    PollModule,
    RedisModule,
    RecorderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
