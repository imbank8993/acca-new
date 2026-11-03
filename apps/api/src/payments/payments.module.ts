import { Module } from '@nestjs/common';
import { CommitteeService } from './committee.service';
import { PaymentsController } from './payments.controller';
import { PaymentReportsService } from './payment-reports.service';
import { PaymentVerificationsController } from './payment-verifications.controller';
import { PaymentVerificationsService } from './payment-verifications.service';
@Module({controllers:[PaymentsController,PaymentVerificationsController],providers:[CommitteeService,PaymentReportsService,PaymentVerificationsService]})
export class PaymentsModule {}
