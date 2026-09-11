import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { StatutVariablePaie } from '../../entities/variable-paie.entity';

export class LignePaieLibreDto {
  @IsString() libelle: string;
  @IsNumber() montant: number;
}

export class UpsertVariablePaieDto {
  @IsNumber() employeClientId: number;

  @IsInt() @Min(1) @Max(12) mois: number;

  @IsInt() annee: number;

  @IsNumber() @Min(0) @IsOptional() heuresSupplementaires?: number;

  @IsNumber() @IsOptional() tauxMajorationHeuresSup?: number;

  // ⚠️ @Type()/@ValidateNested sont indispensables ici : sans eux, class-transformer
  // (appelé par le ValidationPipe global en mode `transform: true` + `enableImplicitConversion`)
  // ne sait pas reconstruire correctement les éléments de ces tableaux d'objets imbriqués.
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => LignePaieLibreDto)
  primes?: LignePaieLibreDto[];

  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => LignePaieLibreDto)
  absences?: LignePaieLibreDto[];

  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => LignePaieLibreDto)
  avantagesNature?: LignePaieLibreDto[];

  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => LignePaieLibreDto)
  retenuesDiverses?: LignePaieLibreDto[];

  @IsString() @IsOptional() commentaire?: string;

  @IsEnum(StatutVariablePaie) @IsOptional() statut?: StatutVariablePaie;
}
