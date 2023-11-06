import { Module } from '@nestjs/common'
import { RecorderService } from './service'
import { ClientModule } from 'src/client/module'
import { SessionService } from './session.service'
import { RecorderTranscriptionService } from './transcription.service'
import { ConfigModule } from 'src/config/module'

@Module({
  imports: [ClientModule, ConfigModule],
  providers: [RecorderService, SessionService, RecorderTranscriptionService],
})
export class RecorderModule {}
