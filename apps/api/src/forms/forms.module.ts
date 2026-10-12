import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
