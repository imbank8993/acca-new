import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { DataSystemController } from './data-system.controller';
import { DataSystemService } from './data-system.service';

@Module({
  imports: [AccessModule],
  controllers: [DataSystemController],
  providers: [DataSystemService],
})
export class DataSystemModule {}
