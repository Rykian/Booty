import { Module } from '@nestjs/common'
import { RecorderService } from './service'
import { ClientModule } from 'src/client/module'
import { SessionService } from './session.service'

@Module({
  imports: [ClientModule],
  providers: [RecorderService, SessionService],
})
export class RecorderModule {}
