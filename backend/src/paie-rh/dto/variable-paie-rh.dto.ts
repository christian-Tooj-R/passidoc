import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { StatutVariablePaieRh } from '../../entities/variable-paie-rh.entity';
import { PartRubriqueRh, ChampCalculRubriqueRh } from '../../entities/rubrique-paie-rh.entity';

export class LignePaieLibreRhDto {
  @IsString() libelle: string;
  @IsNumber() montant: number;
}

/**
 * Surcharge ponctuelle Nombre/Base/Taux d'une rubrique pour CE bulletin — voir
 * `SurchargeRubriquePaieRh` (entité `variable-paie-rh.entity.ts`) et l'onglet "Rubriques"
 * du dialogue "Bulletin du salarié". Revalidée côté moteur contre `saisieAutorisee` avant
 * tout usage — voir moteur-calcul-paie-rh.service.ts.
 */
export class SurchargeRubriquePaieRhDto {
  @IsString() rubriqueCode: string;
  @IsEnum(PartRubriqueRh) part: PartRubriqueRh;
  @IsEnum(ChampCalculRubriqueRh) champ: ChampCalculRubriqueRh;
  @IsNumber() valeur: number;
}

export class UpsertVariablePaieRhDto {
  @IsNumber() salarieId: number;

  @IsInt() @Min(1) @Max(12) mois: number;

  @IsInt() annee: number;

  @IsNumber() @Min(0) @IsOptional() heuresSupplementaires?: number;

  @IsNumber() @IsOptional() tauxMajorationHeuresSup?: number;

  // ⚠️ @Type()/@ValidateNested indispensables : sans eux, class-transformer (appelé par le
  // ValidationPipe global en mode `transform: true` + `enableImplicitConversion`) ne sait
  // pas reconstruire correctement les éléments de ces tableaux d'objets imbriqués.
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => LignePaieLibreRhDto)
  primes?: LignePaieLibreRhDto[];

  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => LignePaieLibreRhDto)
  absences?: LignePaieLibreRhDto[];

  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => LignePaieLibreRhDto)
  avantagesNature?: LignePaieLibreRhDto[];

  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => LignePaieLibreRhDto)
  retenuesDiverses?: LignePaieLibreRhDto[];

  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => SurchargeRubriquePaieRhDto)
  surchargesRubriques?: SurchargeRubriquePaieRhDto[];

  @IsString() @IsOptional() commentaire?: string;

  @IsEnum(StatutVariablePaieRh) @IsOptional() statut?: StatutVariablePaieRh;
}
