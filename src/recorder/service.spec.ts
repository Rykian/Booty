import { Test, TestingModule } from '@nestjs/testing'
import { RecorderService } from './service'
import { SessionService } from './session.service'
import {
  ChannelType,
  ChatInputCommandInteraction,
  NonThreadGuildBasedChannel,
  VoiceState,
} from 'discord.js'
import { ClientService } from 'src/client/service'
import { createMock } from '@golevelup/ts-jest'
import { SessionEntity } from './session.entity'
import fs from 'fs/promises'
import { RecorderTranscriptionService } from './transcription.service'

jest.mock('@discordjs/voice')

describe('Service', () => {
  let recorderService: RecorderService
  let sessionService: SessionService
  let transcriptionService: RecorderTranscriptionService
  let mockInteraction: ChatInputCommandInteraction
  let mockVoiceChannel: NonThreadGuildBasedChannel

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecorderService,
        { provide: SessionService, useValue: createMock<SessionService>() },
        { provide: ClientService, useValue: createMock<ClientService>() },
        {
          provide: RecorderTranscriptionService,
          useValue: createMock<RecorderTranscriptionService>(),
        },
      ],
    }).compile()

    recorderService = module.get<RecorderService>(RecorderService)
    sessionService = module.get<SessionService>(SessionService)
    transcriptionService = module.get<RecorderTranscriptionService>(
      RecorderTranscriptionService,
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('startRecording', () => {
    it('should throw an error if the channel is not a voice channel', async () => {
      mockVoiceChannel = createMock<NonThreadGuildBasedChannel>()
      mockVoiceChannel.type = ChannelType.GuildText

      await expect(
        recorderService.startRecording(mockInteraction, mockVoiceChannel),
      ).rejects.toThrow('Channel is not a voice channel')
    })
  })

  describe('handleStateUpdate', () => {
    const interaction = createMock<ChatInputCommandInteraction>()
    const session = createMock<SessionEntity>()
    const oldState = createMock<VoiceState>()
    const newState = createMock<VoiceState>()

    it('finalize session if everyone except the bot left the channel', async () => {
      oldState.channelId = '123'
      newState.channelId = null

      const mockedFinalize = jest
        .spyOn(recorderService, 'finalizeSession')
        .mockImplementation()

      await recorderService.handleStateUpdate(
        '123',
        1,
        interaction,
        session,
        oldState,
        newState,
      )

      expect(mockedFinalize).toBeCalledTimes(1)
    })

    it("don't do anything if state has changed but channel and count did not changed", async () => {
      oldState.channelId = '123'
      newState.channelId = '123'

      const mockedFinalize = jest
        .spyOn(recorderService, 'finalizeSession')
        .mockImplementation()

      await recorderService.handleStateUpdate(
        '123',
        2,
        interaction,
        session,
        oldState,
        newState,
      )

      expect(mockedFinalize).not.toBeCalledTimes(1)
    })
  })

  describe('finalizeSession', () => {
    let interaction: ChatInputCommandInteraction
    let session: SessionEntity

    const files = ['/tmp/file1', '/tmp/file2']
    let mockedGenerateTracks: jest.SpyInstance<
      Promise<string[]>,
      [session: SessionEntity],
      any
    >

    beforeEach(() => {
      interaction = createMock<ChatInputCommandInteraction>()
      session = createMock<SessionEntity>()
      session.transcription = false

      jest.spyOn(fs, 'unlink').mockImplementation()
      mockedGenerateTracks = jest
        .spyOn(sessionService, 'generateTracks')
        .mockImplementation(() => Promise.resolve(files))
    })
    afterEach(jest.clearAllMocks)

    it('should call sessionService.generateTracks', async () => {
      await recorderService.finalizeSession(interaction, session)

      expect(mockedGenerateTracks).toBeCalledTimes(1)
    })

    it('should send files in response to interaction', async () => {
      await recorderService.finalizeSession(interaction, session)

      expect(interaction.editReply).toBeCalledTimes(1)
      expect(interaction.editReply).toBeCalledWith({
        files,
        content: 'Record finished',
      })
    })

    it('should delete generated files', async () => {
      await recorderService.finalizeSession(interaction, session)

      expect(fs.unlink).toBeCalledTimes(2)
      expect(fs.unlink).toHaveBeenNthCalledWith(1, '/tmp/file1')
      expect(fs.unlink).toHaveBeenNthCalledWith(2, '/tmp/file2')
    })

    it('should call transcriptionService.transcribe if transcription is enabled', async () => {
      session.transcription = true

      const mockedTranscribe = jest
        .spyOn(transcriptionService, 'transcribe')
        .mockImplementation(() => Promise.resolve('transcription example'))
      await recorderService.finalizeSession(interaction, session)
      expect(mockedTranscribe).toBeCalledTimes(1)
    })
  })
})
