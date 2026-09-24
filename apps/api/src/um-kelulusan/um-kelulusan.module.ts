import { Module } from '@nestjs/common';
import { UmKelulusanController } from './um-kelulusan.controller';
import { UmKelulusanService } from './um-kelulusan.service';

@Module({
  controllers: [UmKelulusanController],
  providers: [UmKelulusanService],
})
export class UmKelulusanModule {}
