import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf,
} from 'class-validator';
import { CODES_CYCLES, STATUTS_MISSION } from '../missions.util';
import { TypeMission } from '../../entities/mission.entity';

const STATUTS = STATUTS_MISSION as unknown as string[];

export class CreateMissionDto {
  @IsString() @IsNotEmpty({ message: "L'intitulé de la mission est obligatoire." }) @MaxLength(255)
  titre: string;

  @IsOptional() @IsString()
  description?: string;

  /** Montant estimé € HT ; null = non renseigné. */
  @IsOptional() @ValidateIf(o => o.honoraires !== null) @IsNumber() @Min(0)
  honoraires?: number | null;

  @IsOptional() @IsIn(STATUTS, { message: 'Statut de mission invalide.' })
  statut?: string;

  @IsOptional() @ValidateIf(o => o.dateRelance !== null) @IsDateString()
  dateRelance?: string | null;

  @IsOptional() @ValidateIf(o => o.responsableId !== null) @IsInt()
  responsableId?: number | null;

  /** Cycle d'origine ; null / absent = mission hors cycle. */
  @IsOptional() @ValidateIf(o => o.cycle !== null) @IsIn(CODES_CYCLES, { message: 'Cycle de révision inconnu.' })
  cycle?: string | null;

  @IsOptional() @ValidateIf(o => o.exerciceId !== null) @IsInt()
  exerciceId?: number | null;

  @IsOptional() @IsInt()
  annee?: number;

  @IsOptional() @IsIn(Object.values(TypeMission))
  type?: TypeMission;

  @IsOptional() @IsString()
  arguments?: string;

  @IsOptional() @IsString()
  raisonRefus?: string;

  /** Mission refusée d'un exercice antérieur reproposée par celle-ci. */
  @IsOptional() @IsInt()
  repriseDeId?: number;
}

export class UpdateMissionDto {
  @IsOptional() @IsString() @IsNotEmpty({ message: "L'intitulé de la mission est obligatoire." }) @MaxLength(255)
  titre?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @ValidateIf(o => o.honoraires !== null) @IsNumber() @Min(0)
  honoraires?: number | null;

  @IsOptional() @IsIn(STATUTS, { message: 'Statut de mission invalide.' })
  statut?: string;

  @IsOptional() @ValidateIf(o => o.dateRelance !== null) @IsDateString()
  dateRelance?: string | null;

  @IsOptional() @ValidateIf(o => o.responsableId !== null) @IsInt()
  responsableId?: number | null;

  @IsOptional() @ValidateIf(o => o.cycle !== null) @IsIn(CODES_CYCLES, { message: 'Cycle de révision inconnu.' })
  cycle?: string | null;

  @IsOptional() @IsBoolean()
  archivee?: boolean;

  @IsOptional() @IsString()
  arguments?: string;

  @IsOptional() @IsString()
  raisonRefus?: string;
}

export class RecommandationCycleDto {
  @IsOptional() @ValidateIf(o => o.exerciceId !== null) @IsInt()
  exerciceId?: number | null;

  @IsString()
  texte: string;
}

// Valeur brute de la query (obj[key]) : la conversion implicite du ValidationPipe ferait de
// « false » un booléen vrai et d'une liste « A,B » un tableau d'un seul élément.
type Brut = { obj: Record<string, unknown>; key: string };
const liste = ({ obj, key }: Brut) => {
  const v = obj[key];
  if (v == null || v === '') return undefined;
  return (Array.isArray(v) ? v : String(v).split(',')).map(s => String(s).trim()).filter(Boolean);
};
const booleen = ({ obj, key }: Brut) => obj[key] === true || obj[key] === 'true' || obj[key] === '1';

/** Filtres de la vue cabinet (query string). */
export class FiltresMissionsDto {
  @IsOptional() @Transform(liste) @IsIn(STATUTS, { each: true })
  statuts?: string[];

  @IsOptional() @Type(() => Number) @IsInt()
  responsableId?: number;

  @IsOptional() @IsIn([...CODES_CYCLES, 'HORS_CYCLE'])
  cycle?: string;

  @IsOptional() @IsIn(['MOINS_1000', 'DE_1000_A_5000', 'PLUS_5000'])
  tranche?: 'MOINS_1000' | 'DE_1000_A_5000' | 'PLUS_5000';

  @IsOptional() @IsIn(['SEMAINE', 'MOIS', 'RETARD'])
  relance?: 'SEMAINE' | 'MOIS' | 'RETARD';

  @IsOptional() @IsString()
  secteur?: string;

  @IsOptional() @Transform(booleen) @IsBoolean()
  avecMontant?: boolean;

  @IsOptional() @Transform(booleen) @IsBoolean()
  inclureArchivees?: boolean;
}
