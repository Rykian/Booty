import { Injectable, Logger } from '@nestjs/common'
import { EnvService } from 'src/config/env.service'
import { readFile } from 'fs/promises'
import * as R from 'remeda'
import { NodeCue, parseSync } from 'subtitle'
import { SessionEntity } from './session.entity'
import { User } from 'discord.js'

export interface Segment {
  user: User
  start: number
  text: string
}

@Injectable()
export class RecorderTranscriptionService {
  private logger = new Logger(RecorderTranscriptionService.name)
  private transcribeUrl = (languageCode: string) =>
    this.env.WHISPER_URL + `asr?output=srt&language=${languageCode}`

  constructor(private env: EnvService) {}

  async transcribe(session: SessionEntity) {
    if (!session.languageCode) {
      this.logger.debug('Language not specified, detecting...')
      session.languageCode = await this.detectLanguage(
        session.tracks.values().next().value,
      )
      this.logger.debug(`Language detected: ${session.languageCode}`)
    }
    const transcriptions = await R.pipe(
      session.tracks,
      (x) => Array.from(x),
      R.map(([user, file]) => this.transcribeRecord(user, file, session)),
      (x) => Promise.all(x),
    )
    return R.pipe(
      transcriptions,
      R.flatten(),
      R.sortBy((x) => x.start),
      R.map((x) => `${x.user.displayName} — ${x.text.trim()}`),
      R.join('\n\n'),
    )
  }

  transcribeRecord = async (
    user: User,
    file: string,
    session: SessionEntity,
  ): Promise<Segment[]> => {
    this.logger.debug(`Transcribing record of ${user.displayName}`)
    const buffer = await readFile(file)
    const formData = new FormData()
    formData.append('audio_file', new Blob([buffer]))

    try {
      const transcription = await fetch(
        this.transcribeUrl(session.languageCode),
        {
          method: 'POST',
          body: formData,
        },
      ).then((res) => res.text())

      this.logger.debug('Transcription result:')
      this.logger.debug(transcription)

      const result = parseSync(transcription).filter(
        (x) => x.type == 'cue',
      ) as NodeCue[]

      return result.map(
        (segment): Segment => ({
          user,
          start: segment.data.start / 1000,
          text: segment.data.text,
        }),
      )
    } catch (e) {
      this.logger.error(this.transcribeUrl(session.languageCode))
      this.logger.error(e)
    }
  }

  detectLanguage = async (file: string) => {
    const buffer = await readFile(file)
    const formData = new FormData()
    formData.append('audio_file', new Blob([buffer]))
    const request = await fetch(this.env.WHISPER_URL + 'detect-language', {
      method: 'POST',
      body: formData,
    })

    const json = await request.json()

    return json.language_code
  }
}
