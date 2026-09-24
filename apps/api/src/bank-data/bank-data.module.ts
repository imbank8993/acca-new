import { AccessModule } from '../access/access.module';
import { Module } from '@nestjs/common';
import { BankDataController } from './bank-data.controller';
import { BankDataService } from './bank-data.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [BankDataController],
  providers: [BankDataService],
  exports: [BankDataService],
})
export class BankDataModule {}
