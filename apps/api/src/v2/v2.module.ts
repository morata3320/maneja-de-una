import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  AdminV2Controller,
  AuthV2Controller,
  CatalogV2Controller,
  FavoritesV2Controller,
  HealthV2Controller,
  PaymentsV2Controller,
  ReservationsV2Controller,
  UsersV2Controller,
  VehiclesV2Controller,
} from './v2.controller';
import { V2Service } from './v2.service';
@Module({
  imports: [AuthModule],
  controllers: [
    AuthV2Controller,
    UsersV2Controller,
    VehiclesV2Controller,
    FavoritesV2Controller,
    ReservationsV2Controller,
    PaymentsV2Controller,
    AdminV2Controller,
    HealthV2Controller,
    CatalogV2Controller,
  ],
  providers: [V2Service],
})
export class V2Module {}
