import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ObservasiKelasService } from './observasi-kelas.service';
import { ObservasiKelasController } from './observasi-kelas.controller';

@Module({
  imports: [AccessModule],
  controllers: [ObservasiKelasController],
  providers: [ObservasiKelasService],
  exports: [ObservasiKelasService],
})
export class ObservasiKelasModule {}
