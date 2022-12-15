import { Module } from '@nestjs/common';
import { ConfigModule } from 'src/config/module';
import { ClientService } from './service';

@Module({
  providers: [ClientService],
  imports: [ConfigModule],
})
export class ClientModule {}
