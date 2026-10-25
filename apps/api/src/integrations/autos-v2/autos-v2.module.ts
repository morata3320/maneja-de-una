import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SecurityModule } from '../../security/security.module';
import { AutosV2Controller } from './autos-v2.controller';
import { AutosV2Guard } from './autos-v2.guard';
import { AutosV2Service } from './autos-v2.service';

@Module({
  imports: [AuthModule, SecurityModule],
  controllers: [AutosV2Controller],
  providers: [AutosV2Service, AutosV2Guard],
})
export class AutosV2Module {}
