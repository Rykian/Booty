import { Injectable, Logger } from '@nestjs/common'
import { EnvService } from 'src/config/env.service'
import { readFile } from 'fs/promises'
import * as R from 'remeda'

export interface Segment {
  user: string
  start: number
  text: string
}

@Injectable()
export class RecorderTranscriptionService {
  private logger = new Logger(RecorderTranscriptionService.name)

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
      const transcription = await fetch(
        this.env.WHISPER_URL + 'asr?output=json&language=fr',
        {
          method: 'POST',
          body: formData,
        },
      )
      const result = await transcription.json()

      return result.segments.map(
        (segment): Segment => ({
          user,
          start: segment[2],
          text: segment[4],
        }),
      )
    } catch (e) {
      this.logger.error(this.env.WHISPER_URL + 'asr?language=fr')
      this.logger.error(e)
    }
  }
}
