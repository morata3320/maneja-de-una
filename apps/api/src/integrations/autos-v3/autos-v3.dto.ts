import { Type } from 'class-transformer';
import {
  IsDateString,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class DriverV3Dto {
  @IsString() full_name!: string;
  @IsEmail() email!: string;
  @IsString() phone!: string;
  @IsString() license_number!: string;
  @IsOptional() @IsString() country_license?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(100) age!: number;
  @IsOptional() @IsString() flight_number?: string;
}

export class CreateAutoOrderV3Dto {
  @IsString() vehicle_id!: string;
  @IsDateString() pickup_date!: string;
  @IsDateString() dropoff_date!: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):(?:00|30)$/) pickup_time?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):(?:00|30)$/) dropoff_time?: string;
  @IsOptional() @IsString() pickup_location?: string;
  @IsOptional() @IsString() dropoff_location?: string;
  @IsOptional()
  @IsIn(['BASIC', 'BASICA', 'TOTAL', 'PREMIUM'])
  coverage_type?: string;
  @IsDefined() @ValidateNested() @Type(() => DriverV3Dto) driver!: DriverV3Dto;
}
