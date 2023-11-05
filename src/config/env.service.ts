import { Injectable } from '@nestjs/common'
import * as dotenv from 'dotenv'
import { cleanEnv, host, num, port, str, url, ValidatorSpec } from 'envalid'

const DEFAULT_ENV = 'development'

if (typeof process.env.NODE_ENV == 'undefined') {
  process.env.NODE_ENV = DEFAULT_ENV
}

const validations = {
  NODE_ENV: str({
    default: DEFAULT_ENV,
    choices: ['development', 'production', 'test'],
  }),
  DISCORD_TOKEN: str({ desc: 'Discord bot token' }),
  DISCORD_CLIENT_ID: str({ desc: 'Discord client ID' }),
  MUSIC_DEFAULT_VOLUME: num({
    default: 3,
    example: '3',
    desc: 'Default volume (0 to 10)',
  }),
  REDIS_URL: url({
    devDefault: 'redis://localhost/',
    default: 'redis://redis/',
    example: 'redis://localhost/',
  }),
  LAVALINK_HOST: host({
    devDefault: 'localhost',
    default: 'lavalink',
    example: 'localhost',
    desc: 'Lavalink host',
  }),
  LAVALINK_PORT: port({
    default: 2333,
    example: '2333',
    desc: 'Lavalink port',
  }),
  LAVALINK_PASSWORD: str({
    default: 'youshallnotpass',
    desc: 'Lavalink password',
  }),
  WHISPER_URL: url({
    devDefault: 'http://localhost:9000',
    default: 'http://whisper:9000',
    desc: 'URL of the whisper server with the trailing slash',
  }),
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
  NODE_ENV: 'development' | 'production' | 'test'
  DISCORD_TOKEN: string
  DISCORD_CLIENT_ID: string
  MUSIC_DEFAULT_VOLUME: number
  REDIS_URL: string
  LAVALINK_HOST: string
  LAVALINK_PORT: number
  LAVALINK_PASSWORD: string
  WHISPER_URL: string

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
