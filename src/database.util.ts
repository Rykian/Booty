import { SequelizeModule } from '@nestjs/sequelize'
import dbConfig from './database.json'
import { SequelizeOptions } from 'sequelize-typescript'
import { Logger } from '@nestjs/common'
import {yellow} from '@nestjs/common/utils/cli-colors.util'

export const ENV = (process.env.NODE_ENV || 'development') as
  | 'development'
  | 'test'
  | 'production'

const logger = new Logger('SQL')

export const sequelizeForRoot = (override?: SequelizeOptions) =>
  SequelizeModule.forRoot({
    ...dbConfig[ENV],
    benchmark: true,
    logging: (sql, timing) => {

      logger.debug(`${sql} ${yellow(`+${timing}ms`)}`)
    },
    ...override,
  } as SequelizeOptions)
