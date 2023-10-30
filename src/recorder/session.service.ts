import { Injectable, Logger } from '@nestjs/common'
import { SessionEntity } from './session.entity'
import { differenceInMilliseconds } from 'date-fns'
import { EndBehaviorType, VoiceReceiver } from '@discordjs/voice'
import { createWriteStream } from 'fs'
import * as prism from 'prism-media'
import { pipeline } from 'stream'
import tempfile from 'tempfile'
import { ClientService } from 'src/client/service'
import { mkdir, unlink } from 'fs/promises'
import { cwd } from 'process'
import { execSync } from 'child_process'
import ffmpegPath from 'ffmpeg-static'

@Injectable()
export class SessionService {
  private logger = new Logger(SessionService.name)
  constructor(private client: ClientService) {}

  /** Generate tracks for each users */
  async generateTracks(session: SessionEntity) {
    const users = Array.from(session.records.keys())
    this.logger.log(`${users.length} tracks to generate`)
    const promises = users.map((user) => {
      return this.generateUserTrack(session, user)
    })
    return await Promise.all(promises)
  }

  /** Generate the track for a user */
  private async generateUserTrack(session: SessionEntity, userId: string) {
    const user = await this.client.users.fetch(userId)
    this.logger.log(`Generating track for ${user.globalName}`)
    const directory = `${cwd()}/tmp/${session.voiceChannel.id}-${
      session.voiceChannel.name
    }/${this.date(session.start)}`
    await mkdir(directory, { recursive: true })
    const filename = `${directory}/${user.globalName}.ogg`
    const instructions: string[] = []
    const records = session.getUserRecords(userId)
    let partsNumber = 0

    records.forEach((record, i) => {
      const silence =
        differenceInMilliseconds(
          record.start,
          i == 0 ? session.start : records[i - 1].end,
        ) / 1000

      if (silence > 0) {
        partsNumber++
        instructions.push(this.generateSilenceCommand(silence))
        this.logger.log(`Silence duration: ${silence}s`)
      }

      partsNumber++
      instructions.push(`-i ${record.file}`)
      this.logger.log(`File: ${record.file}`)
    })

    const filterComplex =
      records.map((_, idx) => `[${idx}:a]`).join('') +
      `concat=n=${partsNumber}:v=0:a=1[aout]`

    const command = `${ffmpegPath} ${instructions.join(
      ' ',
    )} -filter_complex "${filterComplex}" -map "[aout]" ${filename}`

    this.logger.debug(`Command: ${command}`)
    execSync(command)
    this.logger.log('Finished writing to', filename)

    this.logger.debug('Removing original files...')
    const deletions = records.map((record) => unlink(record.file))
    await Promise.all(deletions)
    this.logger.debug('Files removed')
    return filename
  }

  /**
   * Generate a date usable in filename
   * @param date
   * @returns
   */
  private date = (date: Date): string =>
    date.toISOString().replace(/[^a-zA-Z0-9_-]/g, '_')

  /**
   * Record user on a Discord voice channel when they're talking
   * @param receiver Discord voice receiver
   * @param user Discord user speaking
   * @param session current recording session
   */
  async recordUser(
    receiver: VoiceReceiver,
    userId: string,
    session: SessionEntity,
  ) {
    const start = new Date()
    const filename = tempfile()

    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 100,
      },
    })

    const oggStream = new prism.opus.OggLogicalBitstream({
      opusHead: new prism.opus.OpusHead({ channelCount: 2, sampleRate: 48000 }),
      pageSizeControl: { maxPackets: 10 },
    })
    const out = createWriteStream(filename)

    this.logger.debug(`👂 Started recording ${filename}`)

    pipeline(opusStream, oggStream, out, (err) => {
      if (err) {
        this.logger.warn(`❌ Error recording file ${filename} - ${err.message}`)
      } else {
        this.logger.debug(`✅ Recorded ${filename}`)
        session.addRecord(userId, filename, start)
      }
    })
  }

  private generateSilenceCommand = (duration: number) =>
    `-f lavfi -t ${duration} -i anullsrc=r=48000:cl=stereo`
}
