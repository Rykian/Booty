import { Module } from '@nestjs/common';
import { ConfigModule } from 'src/config/module';
import { ClientService } from './service';

@Module({
  exports: [ClientService],
  providers: [ClientService],
  imports: [ConfigModule],
})
export class ClientModule {}
