import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ClientModule } from './client/module'
import { MusicModule } from './music/module'
import { PollModule } from './poll/module'
import { RedisModule } from './redis/module'

import dbConfig from './database.json'
import { SequelizeOptions } from 'sequelize-typescript'
import { RecorderModule } from './recorder/module'
const ENV = (process.env.NODE_ENV || 'development') as
  | 'development'
  | 'test'
  | 'production'

console.log({ dbConfig, ENV })

@Module({
  imports: [
    SequelizeModule.forRoot(dbConfig[ENV] as Partial<SequelizeOptions>),
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
