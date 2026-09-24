import { Module } from '@nestjs/common';
import { IzinGuruService } from './izin-guru.service';
import { IzinGuruController } from './izin-guru.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IzinGuruController],
  providers: [IzinGuruService],
})
export class IzinGuruModule {}
