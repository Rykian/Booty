import {
  BelongsTo,
  Column,
  ForeignKey,
  HasMany,
  Model,
  Table,
} from 'sequelize-typescript'
import { Answer } from './answer.entity'
import { Poll } from './poll.entity'

@Table
export class Choice extends Model {
  @Column
  title: string

  @BelongsTo(() => Poll)
  poll: Poll

  @ForeignKey(() => Poll)
  pollId: number

  @HasMany(() => Answer)
  answers: Answer[]
}
