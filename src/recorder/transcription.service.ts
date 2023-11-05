import { Injectable, Logger } from '@nestjs/common'
import { EnvService } from 'src/config/env.service'
import { readFile } from 'fs/promises'
import * as R from 'remeda'
import { Cue, NodeCue, parseSync } from 'subtitle'

export interface Segment {
  user: string
  start: number
  text: string
}

@Injectable()
export class RecorderTranscriptionService {
  private logger = new Logger(RecorderTranscriptionService.name)
  private transcribeUrl = this.env.WHISPER_URL + 'asr?output=srt&language=fr'

  constructor(private env: EnvService) {}

  async transcribe(files: string[]) {
    this.logger.log(`Transcribing ${files.length} files`)
    const transcriptions = await R.pipe(
      files,
      R.map(this.transcribeRecord),
      (x) => Promise.all(x),
    )
    return R.pipe(
      transcriptions,
      R.flatten(),
      R.sortBy((x) => x.start),
      R.map((x) => `${x.user} — ${x.text}`),
      R.join('\n\n'),
    )
  }

  transcribeRecord = async (file: string): Promise<Segment[]> => {
    this.logger.debug(`Transcribing ${file}`)
    const buffer = await readFile(file)
    const formData = new FormData()
    formData.append('audio_file', new Blob([buffer]))
    const user = file.split('/').pop().split('.')[0]
    try {
      const transcription = await fetch(this.transcribeUrl, {
        method: 'POST',
        body: formData,
      }).then((res) => res.text())

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
      this.logger.error(this.transcribeUrl)
      this.logger.error(e)
    }
  }
}
