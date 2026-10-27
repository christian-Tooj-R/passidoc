import { IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsPositive, IsString, Matches } from 'class-validator';
import { LIEUX_TRAVAIL } from '../lieu-travail';
import { TypeTemps, CategorieNonFacturable } from '../../entities/saisie-temps.entity';

export class CreateSaisieTempsDto {
  @IsDateString()
  date: string;

  @IsNumber()
  @IsPositive()
  dureeHeures: number;

  @IsEnum(TypeTemps)
  type: TypeTemps;

  @IsEnum(CategorieNonFacturable)
  @IsOptional()
  categorie?: CategorieNonFacturable;

  @IsString()
  @IsOptional()
  missionCode?: string;

  @IsNumber()
  @IsOptional()
  dossierId?: number;

  @IsString()
  @IsOptional()
  commentaire?: string;

  @IsNumber()
  @IsOptional()
  clientId?: number;

  @IsString()
  @IsOptional()
  heureDebut?: string;

  @IsString()
  @IsOptional()
  heureFin?: string;

  /** Affaire (exercice du dossier, ex. « C2026-09 »). Absente ou null = attribution automatique. */
  @Matches(/^C\d{4}-(0[1-9]|1[0-2])$/, { message: 'Affaire invalide (format attendu : C2026-09).' })
  @IsOptional()
  affaire?: string | null;

  /** Pôle de travail (cahier v2 #5) — défaut : site du collaborateur. */
  @IsIn(LIEUX_TRAVAIL as unknown as string[], { message: 'Pôle de travail invalide (EST, OUEST ou HORS_BUREAU).' })
  @IsOptional()
  lieuTravail?: string | null;
}
