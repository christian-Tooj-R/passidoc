import { Type } from 'class-transformer';
import {
  IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, ValidateNested,
} from 'class-validator';
import {
  ImputationRubriqueRh, SourceOperandeRubriqueRh, TypeCalculRubriqueRh,
} from '../../entities/rubrique-paie-rh.entity';

export class OperandeCalculDto {
  @IsEnum(SourceOperandeRubriqueRh) source: SourceOperandeRubriqueRh;
  @IsNumber() @IsOptional() valeur?: number | null;
  @IsString() @IsOptional() constanteCode?: string | null;
}

export class ElementCalculPartDto {
  @ValidateNested() @Type(() => OperandeCalculDto) nombre: OperandeCalculDto;
  @ValidateNested() @Type(() => OperandeCalculDto) base: OperandeCalculDto;
  @ValidateNested() @Type(() => OperandeCalculDto) taux: OperandeCalculDto;
  @IsBoolean() reportApresCloture: boolean;
  @IsBoolean() impressionBulletin: boolean;
  @IsBoolean() saisieAutorisee: boolean;
}

export class CreateRubriquePaieRhDto {
  @IsString() code: string;
  @IsString() libelle: string;
  @IsString() @IsOptional() memo?: string;
  @IsString() @IsOptional() regimePaieCode?: string;
  @IsString() @IsOptional() dateEffet?: string;
  @IsEnum(TypeCalculRubriqueRh) @IsOptional() typeCalcul?: TypeCalculRubriqueRh;
  @ValidateNested() @Type(() => ElementCalculPartDto) elementSalarial: ElementCalculPartDto;
  @ValidateNested() @Type(() => ElementCalculPartDto) @IsOptional() elementPatronal?: ElementCalculPartDto | null;
  @IsString() @IsOptional() assietteRubriqueCode?: string | null;
  @IsBoolean() @IsOptional() reportAssiette?: boolean;
  @IsNumber() @IsOptional() plafondMensuel?: number;
  @IsEnum(ImputationRubriqueRh) @IsOptional() imputation?: ImputationRubriqueRh;
  @IsInt() @IsOptional() ordreAffichage?: number;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsString() @IsOptional() compteComptable?: string;
  @IsString() @IsOptional() notes?: string;
}

export class UpdateRubriquePaieRhDto {
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() libelle?: string;
  @IsString() @IsOptional() memo?: string;
  @IsString() @IsOptional() regimePaieCode?: string;
  @IsString() @IsOptional() dateEffet?: string;
  @IsEnum(TypeCalculRubriqueRh) @IsOptional() typeCalcul?: TypeCalculRubriqueRh;
  @ValidateNested() @Type(() => ElementCalculPartDto) @IsOptional() elementSalarial?: ElementCalculPartDto;
  @ValidateNested() @Type(() => ElementCalculPartDto) @IsOptional() elementPatronal?: ElementCalculPartDto | null;
  @IsString() @IsOptional() assietteRubriqueCode?: string | null;
  @IsBoolean() @IsOptional() reportAssiette?: boolean;
  @IsNumber() @IsOptional() plafondMensuel?: number;
  @IsEnum(ImputationRubriqueRh) @IsOptional() imputation?: ImputationRubriqueRh;
  @IsInt() @IsOptional() ordreAffichage?: number;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsString() @IsOptional() compteComptable?: string;
  @IsString() @IsOptional() notes?: string;
}
