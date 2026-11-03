import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentReceiptsService } from './payment-receipts.service';
@Controller('pembayaran-massal')
@UseGuards(JwtAuthGuard)
export class PaymentReceiptsController {
  constructor(private service: PaymentReceiptsService) {}
  @Get() list(@Req() req: any, @Query() query: any) { return this.service.list(req.user, query); }
  @Post('analyze') analyze(@Req() req: any, @Body() body: any) { return this.service.analyze(req.user, body); }
  @Post('apply') apply(@Req() req: any, @Body() body: any) { return this.service.apply(req.user, body); }
  @Get('evidence') evidence(@Req() req: any, @Query() query: any) { return this.service.evidence(req.user, query); }
  @Get('bukti') async image(@Req() req: any, @Query('id') id: string, @Res() res: any) {
    const image = await this.service.image(req.user, id);
    res.set({ 'Content-Type': image.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' });
    res.send(image.image);
  }
}
