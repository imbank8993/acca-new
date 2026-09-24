import { Module } from '@nestjs/common';
import { EkskulController } from './ekskul.controller';
import { EkskulService } from './ekskul.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';
import { EkskulSubmissionController } from './ekskul-submission.controller';
import { EkskulSubmissionService } from './ekskul-submission.service';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [EkskulController, EkskulSubmissionController],
  providers: [EkskulService, EkskulSubmissionService],
  exports: [EkskulService, EkskulSubmissionService],
})
export class EkskulModule {}
