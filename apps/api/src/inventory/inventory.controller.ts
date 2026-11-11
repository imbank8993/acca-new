import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PageAccessGuard, RequiresPage } from '../auth/page-access.guard';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PageAccessGuard)
@RequiresPage('inventaris')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get('items') items(@Query() query: any) { return this.service.items(query); }
  @Post('items') createItem(@Body() body: any, @Req() req: any) { return this.service.createItem(body, req.user); }
  @Patch('items/:id') updateItem(@Param('id') id: string, @Body() body: any, @Req() req: any) { return this.service.updateItem(id, body, req.user); }
  @Get('loans') loans(@Req() req: any) { return this.service.loans(req.user); }
  @Post('loans') request(@Body() body: any, @Req() req: any) { return this.service.request(body, req.user); }
  @Patch('loans/:id') transition(@Param('id') id: string, @Body() body: any, @Req() req: any) { return this.service.transition(id, body, req.user); }
}
