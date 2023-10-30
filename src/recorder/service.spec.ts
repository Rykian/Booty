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
import { VoiceConnection } from '@discordjs/voice'
import fs from 'fs/promises'

jest.mock('@discordjs/voice')

describe('Service', () => {
  let recorderService: RecorderService
  let sessionService: SessionService
  let mockInteraction: ChatInputCommandInteraction
  let mockVoiceChannel: NonThreadGuildBasedChannel

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecorderService,
        { provide: SessionService, useValue: createMock<SessionService>() },
        { provide: ClientService, useValue: createMock<ClientService>() },
      ],
    }).compile()

    recorderService = module.get<RecorderService>(RecorderService)
    sessionService = module.get<SessionService>(SessionService)
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
    const connection = createMock<VoiceConnection>()
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
        connection,
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
        connection,
        session,
        oldState,
        newState,
      )

      expect(mockedFinalize).not.toBeCalledTimes(1)
    })
  })

  describe('finalizeSession', () => {
    const interaction = createMock<ChatInputCommandInteraction>()
    const session = createMock<SessionEntity>()
    jest.spyOn(fs, 'unlink').mockImplementation()

    it('should call sessionService.generateTracks', async () => {
      const mockedGenerateTracks = jest
        .spyOn(sessionService, 'generateTracks')
        .mockImplementation(() => Promise.resolve(['file1', 'file2']))

      await recorderService.finalizeSession(interaction, session)

      expect(mockedGenerateTracks).toBeCalledTimes(1)
    })

    it('should send files in response to interaction', async () => {
      const files = ['file1', 'file2']
      jest
        .spyOn(sessionService, 'generateTracks')
        .mockImplementation(() => Promise.resolve(files))

      await recorderService.finalizeSession(interaction, session)

      expect(interaction.editReply).toBeCalledTimes(1)
      expect(interaction.editReply).toBeCalledWith({
        files,
        content: 'Record finished',
      })
    })

    it('should delete generated files', async () => {
      const files = ['file1', 'file2']
      jest
        .spyOn(sessionService, 'generateTracks')
        .mockImplementation(() => Promise.resolve(files))

      await recorderService.finalizeSession(interaction, session)

      expect(fs.unlink).toBeCalledTimes(2)
      expect(fs.unlink).toHaveBeenNthCalledWith(1, 'file1')
      expect(fs.unlink).toHaveBeenNthCalledWith(2, 'file2')
    })
  })
})
