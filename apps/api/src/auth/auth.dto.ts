import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class LoginDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ minLength: 10, maxLength: 72 })
  @IsString()
  @Length(10, 72)
  password: string;
}
export class RegisterDto extends LoginDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  name: string;
}
