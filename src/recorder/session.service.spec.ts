import { Test } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { SessionService } from './session.service'
import { ClientService } from 'src/client/service'
import { SessionEntity } from './session.entity'
import { User, VoiceChannel } from 'discord.js'
import { RecordEntity } from './record.entity'
import { copyFile } from 'fs/promises'
import tempfile from 'tempfile'
import * as R from 'remeda'
import { VoiceConnection } from '@discordjs/voice'

describe(SessionService.name, () => {
  let service: SessionService
  let clientService: ClientService

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: ClientService, useValue: createMock<ClientService>() },
      ],
    }).compile()

    service = moduleRef.get<SessionService>(SessionService)
    clientService = moduleRef.get<ClientService>(ClientService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('date', () => {
    it('returns a string', () => {
      const date = service['date'](new Date())
      expect(typeof date).toBe('string')
      expect(date).toMatch(/\d+/)
      expect(date).not.toMatch(/[/:]/)
    })
  })

  describe('generateTracks', () => {
    it('returns 0 file paths', async () => {
      const channel = createMock<VoiceChannel>()
      const connection = createMock<VoiceConnection>()
      const entity = new SessionEntity(channel, connection)

      expect(await service.generateTracks(entity)).toHaveLength(0)
    })

    it('returns 3 file path if there is 3 user', async () => {
      const channel = createMock<VoiceChannel>({ id: '123', name: 'test' })
      const connection = createMock<VoiceConnection>()
      const entity = new SessionEntity(channel, connection)
      const globalUserNames = ['user1', 'user2', 'user3']
      await R.pipe(
        globalUserNames,
        R.map(async (name) => {
          const record = new RecordEntity()
          record.start = new Date()
          record.end = new Date()
          record.file = tempfile()

          await copyFile('./fixtures/audio.ogg', record.file)
          entity.records.set(name, [record])
        }),
        (x) => Promise.all(x),
      )
      clientService.users.fetch = jest.fn(async (userId: string, _options) =>
        createMock<User>({
          globalName: userId,
          toString: () => `<@${userId}>`,
        }),
      )

      expect(await service.generateTracks(entity)).toHaveLength(3)
    })

    it('filepaths contains name of the user', async () => {
      const channel = createMock<VoiceChannel>({ id: '123', name: 'test' })
      const connection = createMock<VoiceConnection>()
      const entity = new SessionEntity(channel, connection)
      const username = 'userName'
      const record = new RecordEntity()
      record.start = new Date()
      record.end = new Date()
      record.file = tempfile()

      await copyFile('./fixtures/audio.ogg', record.file)
      entity.records.set(username, [record])

      clientService.users.fetch = jest.fn(async (userId: string, _options) =>
        createMock<User>({
          globalName: userId,
          toString: () => `<@${userId}>`,
        }),
      )

      const filepaths = await service.generateTracks(entity)

      expect(filepaths).toHaveLength(1)
      expect(filepaths[0]).toContain(`${username}.ogg`)
    })
  })
})
