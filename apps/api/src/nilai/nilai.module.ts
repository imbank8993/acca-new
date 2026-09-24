import { Module } from '@nestjs/common';
import { NilaiController } from './nilai.controller';
import { NilaiService } from './nilai.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NilaiController],
  providers: [NilaiService],
  exports: [NilaiService],
})
export class NilaiModule {}
