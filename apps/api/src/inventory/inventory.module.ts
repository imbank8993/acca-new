import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({ imports: [AccessModule], controllers: [InventoryController], providers: [InventoryService] })
export class InventoryModule {}
