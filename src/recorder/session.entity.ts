import { User, VoiceChannel } from 'discord.js'
import { RecordEntity } from './record.entity'
import { VoiceConnection } from '@discordjs/voice'

export class SessionEntity {
  start: Date = new Date()
  /* Bits of recording received by Discord.js */
  records: Map<string, RecordEntity[]> = new Map()
  /* Finalized tracks generated */
  tracks: Map<User, string> = new Map()
  channel: VoiceChannel
  connection: VoiceConnection
  transcription: boolean = false
  languageCode: string

  constructor(channel: VoiceChannel, connection: VoiceConnection) {
    this.channel = channel
    this.connection = connection
  }

  getUserRecords = (userId: string): RecordEntity[] => {
    const userRecords = this.records.get(userId)
    if (userRecords) return userRecords

    const createdRecords = []
    this.records.set(userId, createdRecords)
    return createdRecords
  }

  addRecord = (
    userId: string,
    filepath: string,
    start: Date,
    end: Date = new Date(),
  ) => {
    const record = new RecordEntity()
    record.start = start
    record.end = end
    record.file = filepath

    this.getUserRecords(userId).push(record)
  }
}
