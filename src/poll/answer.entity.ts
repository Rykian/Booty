import {
  BelongsTo,
  Column,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript'
import { Choice } from './choices.entity'
import { Poll } from './poll.entity'

@Table({ timestamps: false })
export class Answer extends Model {
  @Column
  userId: string

  @BelongsTo(() => Choice)
  choice: Choice

  @ForeignKey(() => Choice)
  choiceId: number

  @BelongsTo(() => Poll)
  poll: Poll

  @ForeignKey(() => Poll)
  pollId: number
}
