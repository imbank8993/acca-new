import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { PrestasiService } from './prestasi.service';
import { PrestasiController } from './prestasi.controller';

@Module({
  imports: [AccessModule],
  controllers: [PrestasiController],
  providers: [PrestasiService],
  exports: [PrestasiService],
})
export class PrestasiModule {}
