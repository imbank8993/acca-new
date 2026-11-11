import { Module } from '@nestjs/common';
import { InformasiController } from './informasi.controller';
import { InformasiService } from './informasi.service';
import { StorageService } from '../common/storage.service';
import { FeatureAccessGuard } from '../auth/feature-access.guard';

@Module({
  controllers: [InformasiController],
  // FeatureAccessGuard didaftarkan sebagai provider karena selain dipakai
  // sebagai guard, service juga meminjam pembacaan konfigurasinya untuk
  // menentukan cakupan baca (`bolehKelola`).
  providers: [InformasiService, StorageService, FeatureAccessGuard]
})
export class InformasiModule {}
