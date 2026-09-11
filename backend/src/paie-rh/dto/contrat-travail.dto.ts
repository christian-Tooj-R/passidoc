import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { StatutContratTravail, TypeContratTravail } from '../../entities/contrat-travail.entity';

export class CreateContratTravailDto {
  @IsNumber() salarieId: number;

  @IsEnum(TypeContratTravail) @IsOptional() typeContrat?: TypeContratTravail;

  @IsString() dateDebut: string;

  @IsString() @IsOptional() dateFin?: string;

  @IsNumber() @Min(0) @Max(100) @IsOptional() quotiteTravail?: number;

  @IsNumber() @Min(0) salaireBase: number;

  /** Si omis, hérité de `user.antenne` (EST/OUEST) — repli sur 'TOUS' si non renseignée */
  @IsString() @IsOptional() regimePaieCode?: string;

  @IsString() @IsOptional() motif?: string;
}

export class UpdateContratTravailDto {
  @IsEnum(TypeContratTravail) @IsOptional() typeContrat?: TypeContratTravail;
  @IsString() @IsOptional() dateDebut?: string;
  @IsString() @IsOptional() dateFin?: string;
  @IsEnum(StatutContratTravail) @IsOptional() statut?: StatutContratTravail;
  @IsNumber() @Min(0) @Max(100) @IsOptional() quotiteTravail?: number;
  @IsNumber() @Min(0) @IsOptional() salaireBase?: number;
  @IsString() @IsOptional() regimePaieCode?: string;
  @IsString() @IsOptional() motifFin?: string;
  /** Motif de la modification, journalisé dans `historique` */
  @IsString() @IsOptional() motif?: string;
}
