import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class SearchAutosV2Dto {
  @IsString() pickup_location!: string;
  @IsOptional() @IsString() dropoff_location?: string;
  @IsDateString() pickup_date!: string;
  @Matches(/^([01]\d|2[0-3]):(?:00|30)$/) pickup_time!: string;
  @IsDateString() dropoff_date!: string;
  @Matches(/^([01]\d|2[0-3]):(?:00|30)$/) dropoff_time!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(18) @Max(100) driver_age?: number;
  @IsOptional() @IsIn(['JOVEN', 'ADULTO', 'SENIOR']) driver_age_bracket?: string;
  @IsOptional() @IsIn(['ALL', 'ECONOMICO', 'COMPACTO', 'SUV', 'PREMIUM', 'VAN']) category?: string;
  @IsOptional() @IsIn(['ALL', 'MANUAL', 'AUTOMATICO']) transmission?: string;
}

export class DriverV2Dto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() documento?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(18) @Max(100) edad?: number;
}

export class CreateAutoOrderV2Dto {
  @IsString() vehicle_id!: string;
  @IsDateString() pickup_date!: string;
  @IsDateString() dropoff_date!: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):(?:00|30)$/) hora_recogida?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):(?:00|30)$/) hora_devolucion?: string;
  @IsOptional() @IsString() pickup_location?: string;
  @IsOptional() @IsString() dropoff_location?: string;
  @ValidateNested() @Type(() => DriverV2Dto) conductor!: DriverV2Dto;
  @IsOptional() @IsIn(['BASICA', 'TOTAL', 'PREMIUM']) tipo_cobertura?: string;
}

export class DigitalCheckinV2Dto {
  @IsString() documento_identidad!: string;
  @IsOptional() @IsString() numero_licencia?: string;
  @IsOptional() @IsDateString() fecha_vencimiento_licencia?: string;
}

export class DeliveryCheckinV2Dto {
  @IsString() licencia_conducir!: string;
  @Type(() => Number) @IsInt() @Min(0) km_salida!: number;
  @IsOptional() @IsString() tecnico_entrega?: string;
}

export class ReturnCheckinV2Dto {
  @Type(() => Number) @IsInt() @Min(0) km_retorno!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) nivel_combustible?: number;
  @IsOptional() @IsString() observaciones?: string;
}

export class MaintenanceV2Dto {
  @IsString() tecnico_id!: string;
  @Type(() => Number) @IsInt() @Min(0) kilometraje_registrado!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(100) nivel_combustible!: number;
  @IsOptional() @IsString() condiciones_carroceria?: string;
  @IsOptional() @IsString() estado_neumaticos?: string;
  @IsOptional() @IsString() observaciones?: string;
  @IsOptional() @IsBoolean() mantenimiento_realizado?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) nuevo_proximo_mantenimiento_km?: number;
}

export class PromotionAgreementV2Dto {
  @IsBoolean() permite_promociones!: boolean;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) porcentaje_descuento_maximo!: number;
  @IsOptional() @IsArray() @IsString({ each: true }) destinos_habilitados?: string[];
  @IsOptional() @IsDateString() vigencia_hasta?: string;
  @IsOptional() @IsString() condiciones_combo?: string;
}

export class CancelOrderV2Dto {
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() motivo?: string;
  @IsOptional() @IsIn(['CLIENTE', 'SAGA_ORCHESTRATOR', 'ADMIN']) solicitante?: string;
}
