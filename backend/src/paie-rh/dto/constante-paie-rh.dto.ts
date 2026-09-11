import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, ValidateNested,
} from 'class-validator';
import {
  ArrondiConstantePaieRh, OperateurCalculConstante, SourceOperandeConstante, TypeConstantePaieRh,
} from '../../entities/constante-paie-rh.entity';

export class OperandeConstanteDto {
  @IsEnum(OperateurCalculConstante) operateur: OperateurCalculConstante;
  @IsEnum(SourceOperandeConstante) source: SourceOperandeConstante;
  @IsString() @IsOptional() constanteCode?: string | null;
  @IsNumber() @IsOptional() valeur?: number | null;
}

export class CreateConstantePaieRhDto {
  @IsString() code: string;
  @IsString() libelle: string;
  @IsString() @IsOptional() memo?: string;
  @IsString() @IsOptional() regimePaieCode?: string;
  @IsEnum(TypeConstantePaieRh) @IsOptional() typeConstante?: TypeConstantePaieRh;
  @IsNumber() @IsOptional() valeur?: number;
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => OperandeConstanteDto) operandes?: OperandeConstanteDto[];
  @IsEnum(ArrondiConstantePaieRh) @IsOptional() arrondi?: ArrondiConstantePaieRh;
  @IsDateString() @IsOptional() dateEffet?: string;
  @IsBoolean() @IsOptional() visible?: boolean;
  @IsString() @IsOptional() notes?: string;
}

export class UpdateConstantePaieRhDto {
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() libelle?: string;
  @IsString() @IsOptional() memo?: string;
  @IsString() @IsOptional() regimePaieCode?: string;
  @IsEnum(TypeConstantePaieRh) @IsOptional() typeConstante?: TypeConstantePaieRh;
  @IsNumber() @IsOptional() valeur?: number;
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => OperandeConstanteDto) operandes?: OperandeConstanteDto[];
  @IsEnum(ArrondiConstantePaieRh) @IsOptional() arrondi?: ArrondiConstantePaieRh;
  @IsDateString() @IsOptional() dateEffet?: string;
  @IsBoolean() @IsOptional() visible?: boolean;
  @IsString() @IsOptional() notes?: string;
}
