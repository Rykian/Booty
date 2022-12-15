import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { cleanEnv, str, ValidatorSpec } from 'envalid';

const DEFAULT_ENV = 'development';

const validations = {
  NODE_ENV: str({ default: DEFAULT_ENV }),
  DISCORD_TOKEN: str(),
};

type Validations = typeof validations;
type ExtractGeneric<Type> = Type extends ValidatorSpec<infer X> ? X : never;

type Variables = {
  [K in keyof Validations]: ExtractGeneric<Validations[K]>;
};

const FILES = [
  '.env',
  '.env.local',
  `.env.${process.env.NODE_ENV || DEFAULT_ENV}`,
  `.env.${process.env.NODE_ENV || DEFAULT_ENV}.local`,
];

@Injectable()
export class EnvService implements Variables {
  NODE_ENV: string;
  DISCORD_TOKEN: string;

  constructor() {
    this.read();
    const env = cleanEnv(process.env, validations);
    Object.keys(env).forEach((k) => (this[k] = env[k]));
  }

  read() {
    FILES.forEach((file) => {
      dotenv.config({ path: file, override: true });
    });
  }
}
