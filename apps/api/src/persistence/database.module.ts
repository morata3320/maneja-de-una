import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseOptions } from './database.config';
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({ ...databaseOptions(), retryAttempts: 1 }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
