import { Injectable } from '@nestjs/common'
import { createClient, RedisClientType } from 'redis'
import { EnvService } from '../config/env.service'

@Injectable()
export class RedisService {
  client: RedisClientType
  constructor(private env: EnvService) {
    this.client = createClient({ url: env.REDIS_URL })
    this.client.on('error', (err) => console.log('Redis Client Error', err))

    this.client.connect()
  }
}
