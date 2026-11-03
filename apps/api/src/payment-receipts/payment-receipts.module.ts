import { Module } from '@nestjs/common';
import { PaymentReceiptsService } from './payment-receipts.service';
import { PaymentReceiptsController } from './payment-receipts.controller';
import { LocalReceiptOcr } from './local-receipt-ocr';
@Module({ controllers: [PaymentReceiptsController], providers: [PaymentReceiptsService, LocalReceiptOcr] })
export class PaymentReceiptsModule {}
