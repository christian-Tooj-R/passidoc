import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { BaseCalculRubrique, ImputationRubrique } from '../../entities/rubrique-paie.entity';

export class CreateRubriquePaieDto {
  @IsString() code: string;
  @IsString() libelle: string;
  @IsString() @IsOptional() regimePaieCode?: string;
  @IsEnum(BaseCalculRubrique) @IsOptional() baseCalcul?: BaseCalculRubrique;
  @IsNumber() @IsOptional() plafondMensuel?: number;
  @IsNumber() @IsOptional() tauxSalarial?: number;
  @IsNumber() @IsOptional() tauxPatronal?: number;
  @IsNumber() @IsOptional() montantFixe?: number;
  @IsEnum(ImputationRubrique) @IsOptional() imputation?: ImputationRubrique;
  @IsInt() @IsOptional() ordreAffichage?: number;
  @IsString() @IsOptional() notes?: string;
}

export class UpdateRubriquePaieDto {
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() libelle?: string;
  @IsString() @IsOptional() regimePaieCode?: string;
  @IsEnum(BaseCalculRubrique) @IsOptional() baseCalcul?: BaseCalculRubrique;
  @IsNumber() @IsOptional() plafondMensuel?: number;
  @IsNumber() @IsOptional() tauxSalarial?: number;
  @IsNumber() @IsOptional() tauxPatronal?: number;
  @IsNumber() @IsOptional() montantFixe?: number;
  @IsEnum(ImputationRubrique) @IsOptional() imputation?: ImputationRubrique;
  @IsInt() @IsOptional() ordreAffichage?: number;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsString() @IsOptional() notes?: string;
}
