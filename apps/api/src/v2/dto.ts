import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsEcuadorianCedula, Lowercase, Trim, Uppercase } from './validation';

const namePattern = /^[\p{L}][\p{L} .'-]*$/u;
export class LoginV2Dto {
  @ApiProperty() @Lowercase() @IsEmail() @MaxLength(254) email: string;
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72)
  declare password: string;
}
export class RegisterV2Dto extends LoginV2Dto {
  @ApiProperty() @Trim() @Length(2, 50) @Matches(namePattern) firstName: string;
  @ApiProperty() @Trim() @Length(2, 50) @Matches(namePattern) lastName: string;
  @ApiProperty({ minLength: 10, maxLength: 10 })
  @Matches(/^\d{10}$/, {
    message: 'Cédula debe contener exactamente 10 dígitos',
  })
  @IsEcuadorianCedula({ message: 'Cédula ecuatoriana inválida' })
  cedula: string;
  @ApiProperty() @Trim() @Matches(/^\+?\d{7,15}$/) phone: string;
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La contraseña requiere mayúscula, minúscula y número',
  })
  declare password: string;
}
export class UserCreateDto extends RegisterV2Dto {
  @ApiPropertyOptional({ enum: ['USER', 'ADMIN'] })
  @IsOptional()
  @IsEnum(['USER', 'ADMIN'])
  role?: 'USER' | 'ADMIN';
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}
export class UserUpdateDto extends PartialType(UserCreateDto) {}
export class SelfUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @Length(2, 50)
  @Matches(namePattern)
  firstName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @Length(2, 50)
  @Matches(namePattern)
  lastName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @Matches(/^\+?\d{7,15}$/)
  phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEcuadorianCedula() cedula?: string;
}
export class UserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] })
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status: string;
}

export class VehicleDto {
  @IsUUID() brandId: string;
  @IsUUID() modelId: string;
  @IsUUID() categoryId: string;
  @IsUUID() locationId: string;
  @Type(() => Number) @IsInt() @Min(1) supplierId: number;
  @Type(() => Number) @IsInt() @Min(1) depotId: number;
  @Type(() => Number)
  @IsInt()
  @Min(1886)
  @Max(new Date().getFullYear() + 2)
  year: number;
  @Trim() @Length(1, 50) color: string;
  @Uppercase() @Matches(/^[A-Z0-9-]{5,12}$/) licensePlate: string;
  @IsEnum(['MANUAL', 'AUTOMATIC']) transmission: string;
  @IsEnum(['GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC']) fuelType: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) seats: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(10) doors: number;
  @Type(() => Number) @IsInt() @Min(0) bagCapacity: number;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10000)
  pricePerDay: number;
  @Type(() => Number) @IsInt() @Min(0) mileage: number;
  @Trim() @MaxLength(2000) description: string;
  @IsEnum(['AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE', 'INACTIVE'])
  status: string;
  @IsOptional() active?: boolean;
}
export class VehiclePatchDto extends PartialType(VehicleDto) {}
export class ReservationDto {
  @IsUUID() vehicleId: string;
  @IsString() startDate: string;
  @IsString() endDate: string;
  @IsOptional() @IsString() pickupLocation?: string;
  @IsOptional() @IsString() dropoffLocation?: string;
  @IsOptional() extras?: string[];
  @IsOptional() driver?: Record<string, unknown>;
}
export class ReservationPatchDto {
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
}
export class PaymentDto {
  @IsUUID() reservationId: string;
  @Trim()
  @Length(2, 80)
  @Matches(/^(?!\d+$)[\p{L} .'-]+$/u)
  cardholderName: string;
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\s/g, '') : value,
  )
  @Matches(/^\d{13,19}$/)
  cardNumber: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) expiryMonth: number;
  @Type(() => Number) @IsInt() expiryYear: number;
  @Matches(/^\d{3,4}$/) cvv: string;
}
export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() sort?: string;
}
