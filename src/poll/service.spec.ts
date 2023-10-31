import { Test, TestingModule } from '@nestjs/testing'
import { PollService } from './service'
import { Poll } from './poll.entity'
import * as R from 'remeda'
import { Choice } from './choices.entity'
import { ClientService } from 'src/client/service'
import { createMock } from '@golevelup/ts-jest'
import { SequelizeModule } from '@nestjs/sequelize'
import { Answer } from './answer.entity'
import { sequelizeForRoot } from 'src/database.util'

describe('PollService', () => {
  let service: PollService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        sequelizeForRoot(),
        SequelizeModule.forFeature([Poll, Choice, Answer]),
      ],
      providers: [
        { provide: ClientService, useValue: createMock<ClientService>() },
        PollService,
      ],
    }).compile()

    service = module.get<PollService>(PollService)
  })

  afterEach(() => jest.clearAllMocks())

  describe('vote', () => {
    let poll: Poll

    beforeEach(async () => {
      poll = await Poll.create({ question: 'What is your favorite color?' })
      poll.choices = await R.pipe(
        ['Red', 'Blue', 'Green'],
        R.map((c) => Choice.create({ pollId: poll.id, title: c })),
        (x) => Promise.all(x),
      )
    })

    it('should create a new answer', async () => {
      const answer = await service.vote(poll.id, 'Red', '123')
      expect(answer.choices[0].answers.length).toBe(1)
    })

    it('should toggle the answer if user voted 2 times', async () => {
      await service.vote(poll.id, 'Red', '123')
      const answer = await service.vote(poll.id, 'Red', '123')
      expect(answer.choices[0].answers.length).toBe(0)
    })

  })

  describe('createPoll', () => {
    it('should create a new poll', async () => {
      const poll = await service.createPoll('123', 'What is your favorite color?', [
        'Red',
        'Blue',
        'Green',
      ])
      expect(poll.isNewRecord).toBe(false)
      expect(poll.choices.length).toBe(3)
      poll.choices.forEach((choice) => {
        expect(choice.isNewRecord).toBe(false)
      })
    })
  })

  describe
})
