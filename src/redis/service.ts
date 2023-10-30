import { Injectable, Logger } from '@nestjs/common'
import { createClient, RedisClientType } from 'redis'
import { EnvService } from '../config/env.service'

@Injectable()
export class RedisService {
  logger = new Logger(RedisService.name)
  client: RedisClientType
  constructor(private env: EnvService) {
    this.client = createClient({ url: env.REDIS_URL })
    this.client.on('error', (err) =>
      this.logger.error('Redis Client Error', err),
    )

    this.client.connect()
  }
}
