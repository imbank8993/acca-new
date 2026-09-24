import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WaliKelasController } from './wali-kelas.controller';
import { WaliKelasService } from './wali-kelas.service';

@Module({
  imports: [PrismaModule],
  controllers: [WaliKelasController],
  providers: [WaliKelasService],
  exports: [WaliKelasService],
})
export class WaliKelasModule {}
