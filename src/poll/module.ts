import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { ClientModule } from 'src/client/module'
import { RedisModule } from 'src/redis/module'
import { Answer } from './answer.entity'
import { Choice } from './choices.entity'
import { Poll } from './poll.entity'
import { PollService } from './service'

@Module({
  providers: [PollService],
  imports: [
    ClientModule,
    RedisModule,
    SequelizeModule.forFeature([Poll, Answer, Choice]),
  ],
})
export class PollModule {}
