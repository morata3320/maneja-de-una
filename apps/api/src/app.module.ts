import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { DatabaseModule } from './persistence/database.module';
import { SecurityModule } from './security/security.module';
import { AutosModule } from './integrations/autos/autos.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from './config/environment';
import { JsonContentTypeGuard } from './common/guards/json-content-type.guard';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { BrandsModule } from './brands/brands.module';
import { ModelsModule } from './models/models.module';
import { CategoriesModule } from './categories/categories.module';
import { LocationsModule } from './locations/locations.module';
import { RentalsModule } from './rentals/rentals.module';
import { FavoritesModule } from './favorites/favorites.module';
import { BookingModule } from './integrations/booking/booking.module';
import { V2Module } from './v2/v2.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
    SecurityModule,
    AutosModule,
    AdminModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.getOrThrow<number>('RATE_LIMIT_TTL_MS'),
            limit: config.getOrThrow<number>('RATE_LIMIT_MAX'),
          },
        ],
      }),
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    VehiclesModule,
    BrandsModule,
    ModelsModule,
    CategoriesModule,
    LocationsModule,
    RentalsModule,
    FavoritesModule,
    BookingModule,
    V2Module,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JsonContentTypeGuard },
  ],
})
export class AppModule {}
