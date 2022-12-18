import { GatewayIntentBits } from 'discord.js'

interface Options {
  intents?: GatewayIntentBits[]
  permissions?: bigint[]
}

export const intents = new Set<GatewayIntentBits>()
export const permissions = new Set<bigint>()

export const Discordable = (options?: Options) => {
  // eslint-disable-next-line @typescript-eslint/ban-types
  return (target: Function) => {
    console.log(`Loading Discordable configuration for ${target.name}`)
    options?.intents?.map((intent) => intents.add(intent))
    options?.permissions?.map((permission) => permissions.add(permission))
    return
  }
}
