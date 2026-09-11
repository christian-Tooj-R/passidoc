import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FrequenceTache } from '../../entities/tache-recurrente.entity';

export class CreateTacheRecurrenteDto {
  @IsString()
  titre: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(FrequenceTache)
  frequence: FrequenceTache;

  @IsNumber()
  @Min(1)
  @IsOptional()
  delaiAvantEcheanceJours?: number;

  @IsString()
  @IsOptional()
  serviceDestinataire?: string;

  @IsNumber()
  clientId: number;

  @IsNumber()
  @IsOptional()
  assigneAId?: number;
}

export class UpdateTacheRecurrenteDto {
  @IsString()
  @IsOptional()
  titre?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(FrequenceTache)
  @IsOptional()
  frequence?: FrequenceTache;

  @IsNumber()
  @IsOptional()
  delaiAvantEcheanceJours?: number;

  @IsString()
  @IsOptional()
  serviceDestinataire?: string;

  @IsNumber()
  @IsOptional()
  assigneAId?: number;

  @IsOptional()
  isActive?: boolean;
}
