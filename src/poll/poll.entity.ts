import { Column, HasMany, Model, Table } from 'sequelize-typescript'
import { Answer } from './answer.entity'
import { Choice } from './choices.entity'

@Table
export class Poll extends Model {
  @Column
  title: string

  @HasMany(() => Choice)
  choices: Choice[]

  @HasMany(() => Answer)
  answers: Answer[]
}
