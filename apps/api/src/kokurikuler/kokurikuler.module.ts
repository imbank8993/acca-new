import { Module } from '@nestjs/common';
import { KokurikulerController } from './kokurikuler.controller';
import { KokurikulerService } from './kokurikuler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [KokurikulerController],
  providers: [KokurikulerService],
  exports: [KokurikulerService],
})
export class KokurikulerModule {}
