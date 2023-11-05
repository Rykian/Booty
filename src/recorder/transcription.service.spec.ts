import { Test, TestingModule } from '@nestjs/testing'
import { RecorderTranscriptionService, Segment } from './transcription.service'
import { EnvService } from 'src/config/env.service'
import fs from 'fs/promises'
import { createMock } from '@golevelup/ts-jest'

describe('RecorderTranscriptionService', () => {
  let service: RecorderTranscriptionService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecorderTranscriptionService,
        {
          provide: EnvService,
          useValue: { WHISPER_HOST: 'localhost', WHISPER_PORT: 3000 },
        },
      ],
    }).compile()

    service = module.get<RecorderTranscriptionService>(
      RecorderTranscriptionService,
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('transcribe', () => {
    it('returns a string of the transcription', async () => {
      const files = ['/tmp/file1', '/tmp/file2']
      const transcriptions: Segment[][] = [
        [
          { user: 'user1', start: 0, text: 'hello' },
          { user: 'user1', start: 1, text: 'world' },
        ],
        [
          { user: 'user2', start: 0.5, text: 'foo' },
          { user: 'user2', start: 1.5, text: 'bar' },
        ],
      ]
      const expected =
        'user1 — hello\n\nuser2 — foo\n\nuser1 — world\n\nuser2 — bar'
      jest.spyOn(fs, 'readFile').mockResolvedValueOnce(Buffer.from(expected))
      jest
        .spyOn(service, 'transcribeRecord')
        .mockResolvedValueOnce(Promise.resolve(transcriptions[0]))
        .mockResolvedValueOnce(Promise.resolve(transcriptions[1]))

      expect(await service.transcribe(files)).toEqual(expected)
    })
  })

  describe('transcribeRecord', () => {
    it('returns a list of segments', async () => {
      const segments = [
        [0, 0, 0, 0, 'hello'],
        [0, 0, 1, 0, 'world'],
      ]
      jest.spyOn(fs, 'readFile').mockResolvedValueOnce(Buffer.from(''))
      jest.spyOn(global, 'fetch').mockResolvedValue(
        createMock<Response>({
          json: () => Promise.resolve({ segments }),
        }),
      )

      expect(await service.transcribeRecord('/tmp/user1.ogg')).toEqual([
        { user: 'user1', start: 0, text: 'hello' },
        { user: 'user1', start: 1, text: 'world' },
      ])
    })
  })
})
