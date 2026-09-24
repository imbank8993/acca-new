import { Module } from '@nestjs/common';
import { PersonalDocsController } from './personal-docs.controller';
import { PersonalDocsService } from './personal-docs.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';
import { StorageService } from '../common/storage.service';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [PersonalDocsController],
  providers: [PersonalDocsService, StorageService],
})
export class PersonalDocsModule {}
