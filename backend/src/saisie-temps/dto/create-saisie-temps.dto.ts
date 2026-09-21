import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
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
}
