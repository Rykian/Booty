import { Injectable } from '@nestjs/common'
import * as dotenv from 'dotenv'
import { cleanEnv, num, str, ValidatorSpec } from 'envalid'

const DEFAULT_ENV = 'development'

const validations = {
  NODE_ENV: str({ default: DEFAULT_ENV }),
  DISCORD_TOKEN: str(),
  DISCORD_CLIENT_ID: str(),
  MUSIC_DEFAULT_VOLUME: num({ default: 3 }),
  REDIS_URL: str({ default: 'redis://localhost/' }),
  LAVALINK_HOST: str({ default: 'localhost' }),
  LAVALINK_PORT: num({ default: 2333 }),
  LAVALINK_PASSWORD: str({ default: 'youshallnotpass' }),
}

type Validations = typeof validations
type ExtractGeneric<Type> = Type extends ValidatorSpec<infer X> ? X : never

type Variables = {
  [K in keyof Validations]: ExtractGeneric<Validations[K]>
}

const FILES = [
  '.env',
  '.env.local',
  `.env.${process.env.NODE_ENV || DEFAULT_ENV}`,
  `.env.${process.env.NODE_ENV || DEFAULT_ENV}.local`,
]

@Injectable()
export class EnvService implements Variables {
  NODE_ENV: string
  DISCORD_TOKEN: string
  DISCORD_CLIENT_ID: string
  MUSIC_DEFAULT_VOLUME: number
  REDIS_URL: string
  LAVALINK_HOST: string
  LAVALINK_PORT: number
  LAVALINK_PASSWORD: string

  constructor() {
    this.read()
    const env = cleanEnv(process.env, validations)
    Object.keys(env).forEach((k) => (this[k] = env[k]))
  }

  read() {
    FILES.forEach((file) => {
      dotenv.config({ path: file, override: true })
    })
  }
}
