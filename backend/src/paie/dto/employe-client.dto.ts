import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { TypeContratEmployePaie } from '../../entities/employe-client.entity';

export class CreateEmployeClientDto {
  @IsNumber()
  clientId: number;

  @IsString()
  matricule: string;

  @IsString()
  nom: string;

  @IsString()
  prenom: string;

  @IsString()
  @IsOptional()
  poste?: string;

  @IsString()
  @IsOptional()
  dateEntree?: string;

  @IsString()
  @IsOptional()
  dateSortie?: string;

  @IsEnum(TypeContratEmployePaie)
  @IsOptional()
  typeContrat?: TypeContratEmployePaie;

  @IsNumber()
  @Min(0)
  salaireBase: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  quotiteTravail?: number;

  /** Si omis, hérité de `client.site` (REUNION/MADAGASCAR) */
  @IsString()
  @IsOptional()
  regimePaieCode?: string;
}

export class UpdateEmployeClientDto {
  @IsString() @IsOptional() matricule?: string;
  @IsString() @IsOptional() nom?: string;
  @IsString() @IsOptional() prenom?: string;
  @IsString() @IsOptional() poste?: string;
  @IsString() @IsOptional() dateEntree?: string;
  @IsString() @IsOptional() dateSortie?: string;
  @IsEnum(TypeContratEmployePaie) @IsOptional() typeContrat?: TypeContratEmployePaie;
  @IsNumber() @Min(0) @IsOptional() salaireBase?: number;
  @IsNumber() @Min(0) @Max(100) @IsOptional() quotiteTravail?: number;
  @IsString() @IsOptional() regimePaieCode?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}
