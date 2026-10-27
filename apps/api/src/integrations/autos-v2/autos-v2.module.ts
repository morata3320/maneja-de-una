import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SecurityModule } from '../../security/security.module';
import { AutosV2Controller } from './autos-v2.controller';
import { AutosV2Guard } from './autos-v2.guard';
import { AutosV2Service } from './autos-v2.service';
import { InventoryIntegrationModule } from '../inventory/inventory-integration.module';
import { AutosV3Controller } from '../autos-v3/autos-v3.controller';
import { AutosV3Service } from '../autos-v3/autos-v3.service';

@Module({
  imports: [AuthModule, SecurityModule, InventoryIntegrationModule],
  controllers: [AutosV2Controller, AutosV3Controller],
  providers: [AutosV2Service, AutosV3Service, AutosV2Guard],
})
export class AutosV2Module {}
