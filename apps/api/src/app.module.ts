import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { PersonalDocsModule } from './personal-docs/personal-docs.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AccessModule } from './access/access.module';
import { UsersModule } from './users/users.module';
import { OrangtuaModule } from './orangtua/orangtua.module';
import { MasterModule } from './master/master.module';
import { SiswaModule } from './siswa/siswa.module';
import { StudentsModule } from './students/students.module';
import { SettingsModule } from './settings/settings.module';
import { EkskulModule } from './ekskul/ekskul.module';
import { JurnalModule } from './jurnal/jurnal.module';
import { SiteSettingsModule } from './site-settings/site-settings.module';
import { SuratModule } from './surat/surat.module';
import { TugasTambahanModule } from './tugas-tambahan/tugas-tambahan.module';
import { InformasiModule } from './informasi/informasi.module';
import { PengumumanModule } from './pengumuman/pengumuman.module';
import { AgendaModule } from './agenda/agenda.module';
import { NotulensiModule } from './notulensi/notulensi.module';
import { JadwalModule } from './jadwal/jadwal.module';
import { LiburModule } from './libur/libur.module';
import { GuruAsuhModule } from './guru-asuh/guru-asuh.module';
import { MonitoringController } from './monitoring/monitoring.controller';
import { MonitoringModule } from './monitoring/monitoring.module';
import { CatatanSiswaModule } from './catatan-siswa/catatan-siswa.module';
import { KeuanganModule } from './keuangan/keuangan.module';
import { IzinGuruModule } from './izin-guru/izin-guru.module';
import { LaporanPiketModule } from './laporan-piket/laporan-piket.module';
import { UmKelulusanModule } from './um-kelulusan/um-kelulusan.module';
import { DokumenModule } from './dokumen/dokumen.module';
import { ESupervisiModule } from './e-supervisi/e-supervisi.module';
import { KlinikModule } from './klinik/klinik.module';
import { KetidakhadiranModule } from './ketidakhadiran/ketidakhadiran.module';
import { AbsensiModule } from './absensi/absensi.module';
import { LckhModule } from './lckh/lckh.module';
import { PrestasiModule } from './prestasi/prestasi.module';
import { ObservasiKelasModule } from './observasi-kelas/observasi-kelas.module';
import { SanggarModule } from './sanggar/sanggar.module';
import { NilaiModule } from './nilai/nilai.module';
import { TugasSiswaModule } from './tugas-siswa/tugas-siswa.module';
import { WaliKelasModule } from './wali-kelas/wali-kelas.module';
import { FormsModule } from './forms/forms.module';
import { KokurikulerModule } from './kokurikuler/kokurikuler.module';
import { PtspModule } from './ptsp/ptsp.module';
import { AnalisisBebanModule } from './analisis-beban/analisis-beban.module';
import { KinerjaGuruModule } from './kinerja-guru/kinerja-guru.module';

import { NotificationsModule } from './notifications/notifications.module';
import { BankDataModule } from './bank-data/bank-data.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api/.env', '.env'],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    AccessModule,
    UsersModule,
    OrangtuaModule,
    MasterModule,
    SiswaModule,
    StudentsModule,
    SettingsModule,
    EkskulModule,
    JurnalModule,
    SiteSettingsModule,
    SuratModule,
    TugasTambahanModule,
    InformasiModule,
    PengumumanModule,
    AgendaModule,
    NotulensiModule,
    JadwalModule,
    LiburModule,
    PersonalDocsModule,
    DashboardModule,
    GuruAsuhModule,
    MonitoringModule,
    CatatanSiswaModule,
    KeuanganModule,
    IzinGuruModule,
    LaporanPiketModule,
    UmKelulusanModule,
    DokumenModule,
    ESupervisiModule,
    KlinikModule,
    KetidakhadiranModule,
    AbsensiModule,
    LckhModule,
    PrestasiModule,
    ObservasiKelasModule,
    SanggarModule,
    NilaiModule,
    TugasSiswaModule,
    WaliKelasModule,
    FormsModule,
    KokurikulerModule,
    PtspModule,
    AnalisisBebanModule,
    KinerjaGuruModule,
    NotificationsModule,
    BankDataModule,
    AuditModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 120,
    }]),
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
