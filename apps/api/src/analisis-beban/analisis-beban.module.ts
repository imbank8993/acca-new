import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AnalisisBebanController } from './analisis-beban.controller';
import { AnalisisBebanService } from './analisis-beban.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AccessModule, PrismaModule],
  controllers: [AnalisisBebanController],
  providers: [AnalisisBebanService],
  exports: [AnalisisBebanService],
})
export class AnalisisBebanModule {}
