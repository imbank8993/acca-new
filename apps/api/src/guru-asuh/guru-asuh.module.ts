import { Module } from '@nestjs/common';
import { GuruAsuhController } from './guru-asuh.controller';
import { GuruAsuhService } from './guru-asuh.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GuruAsuhController],
  providers: [GuruAsuhService],
  exports: [GuruAsuhService],
})
export class GuruAsuhModule {}
