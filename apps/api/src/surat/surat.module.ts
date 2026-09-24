import { Module } from '@nestjs/common';
import { SuratService } from './surat.service';
import { SuratController, SuratRecordController } from './surat.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, AccessModule],
  providers: [SuratService],
  controllers: [SuratController, SuratRecordController],
})
export class SuratModule {}
