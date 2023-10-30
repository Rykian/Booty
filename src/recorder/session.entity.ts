import { VoiceChannel } from 'discord.js'
import { RecordEntity } from './record.entity'

export class SessionEntity {
  start: Date = new Date()
  records: Map<string, RecordEntity[]> = new Map()
  voiceChannel: VoiceChannel

  constructor(voiceChannel: VoiceChannel) {
    this.voiceChannel = voiceChannel
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
