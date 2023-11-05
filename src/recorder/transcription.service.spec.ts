import { Test, TestingModule } from '@nestjs/testing'
import { RecorderTranscriptionService, Segment } from './transcription.service'
import { EnvService } from 'src/config/env.service'
import fs from 'fs/promises'
import { createMock } from '@golevelup/ts-jest'
import { User } from 'discord.js'
import { SessionEntity } from './session.entity'

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
    const user1 = createMock<User>({
      displayName: 'user1',
      toString: () => '<@1>',
    })
    const user2 = createMock<User>({
      displayName: 'user2',
      toString: () => '<@2>',
    })

    it('returns a string of the transcription', async () => {
      const session = createMock<SessionEntity>({
        tracks: new Map([
          [user1.id, '/tmp/user1.ogg'],
          [user2.id, '/tmp/user2.ogg'],
        ]),
      })
      const transcriptions: Segment[][] = [
        [
          { user: user1, start: 0, text: 'hello' },
          { user: user1, start: 1, text: 'world' },
        ],
        [
          { user: user2, start: 0.5, text: 'foo' },
          { user: user2, start: 1.5, text: 'bar' },
        ],
      ]
      const expected =
        'user1 — hello\n\nuser2 — foo\n\nuser1 — world\n\nuser2 — bar'
      jest.spyOn(fs, 'readFile').mockResolvedValueOnce(Buffer.from(expected))
      jest
        .spyOn(service, 'transcribeRecord')
        .mockResolvedValueOnce(Promise.resolve(transcriptions[0]))
        .mockResolvedValueOnce(Promise.resolve(transcriptions[1]))

      expect(await service.transcribe(session)).toEqual(expected)
    })
  })

  describe('transcribeRecord', () => {
    const user1 = createMock<User>({
      displayName: 'user1',
      toString: () => '<@1>',
    })
    it('returns a list of segments', async () => {
      const response = `1
00:00:00,000 --> 00:00:01,000
hello

2
00:00:01,000 --> 00:00:02,000
world`
      jest.spyOn(fs, 'readFile').mockResolvedValueOnce(Buffer.from(''))
      jest.spyOn(global, 'fetch').mockResolvedValue(
        createMock<Response>({
          text: () => Promise.resolve(response),
        }),
      )

      expect(await service.transcribeRecord(user1, '/tmp/user1.ogg')).toEqual([
        { user: user1, start: 0, text: 'hello' },
        { user: user1, start: 1, text: 'world' },
      ])
    })
  })
})
