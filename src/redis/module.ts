import { Module } from '@nestjs/common'
import { ConfigModule } from 'src/config/module'
import { RedisService } from './service'

@Module({
  exports: [RedisService],
  imports: [ConfigModule],
  providers: [RedisService],
})
export class RedisModule {}
