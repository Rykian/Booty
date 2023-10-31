import { Logger } from '@nestjs/common'
import {
  GatewayIntentBits,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js'

interface Options {
  intents?: GatewayIntentBits[]
  permissions?: bigint[]
  commands?: SlashCommandSubcommandsOnlyBuilder[]
}

export const intents = new Set<GatewayIntentBits>()
export const permissions = new Set<bigint>()
export const commands: SlashCommandSubcommandsOnlyBuilder[] = []

const logger = new Logger('@Discordable')

export const Discordable = (options?: Options) => {
  // eslint-disable-next-line @typescript-eslint/ban-types
  return (target: Function) => {
    logger.debug(`Loading configuration for ${target.name}`)
    options?.intents?.map((intent) => intents.add(intent))
    options?.permissions?.map((permission) => permissions.add(permission))
    if (options?.commands) commands.push(...options.commands)
    return
  }
}
