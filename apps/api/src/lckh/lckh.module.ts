import { Module } from '@nestjs/common';
import { LckhController } from './lckh.controller';
import { LckhService } from './lckh.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LckhController],
  providers: [LckhService],
  exports: [LckhService],
})
export class LckhModule {}
