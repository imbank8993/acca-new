import { Module } from '@nestjs/common';
import { LckhController } from './lckh.controller';
import { LckhService } from './lckh.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [LckhController],
  providers: [LckhService],
  exports: [LckhService],
})
export class LckhModule {}
