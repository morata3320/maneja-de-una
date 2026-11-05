import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimmed = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class FindBookingClientDto {
  @IsOptional() @IsEmail() @MaxLength(254) @trimmed() email?: string;
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @trimmed()
  identificacion?: string;
}

export class CreateBookingClientDto {
  @IsString() @MinLength(2) @MaxLength(200) @trimmed() nombre!: string;
  @IsEmail() @MaxLength(254) @trimmed() email!: string;
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @trimmed()
  identificacion!: string;
  @IsString() @MinLength(7) @MaxLength(32) @trimmed() telefono!: string;
  @IsString() @MinLength(3) @MaxLength(64) @trimmed() licencia!: string;
}
