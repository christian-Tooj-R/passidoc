import { IsString, IsNumber, IsOptional, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class ActionnairesDto {
  @IsOptional() @IsString() nom?: string;
  @IsOptional() @IsString() prenom?: string;
  @IsOptional() @IsNumber() pourcentage?: number;
  @IsOptional() @IsString() regimeFiscal?: string;
}

class GerantDto {
  @IsOptional() @IsString() nom?: string;
  @IsOptional() @IsNumber() age?: number;
  @IsOptional() @IsString() situationFamiliale?: string;
  @IsOptional() @IsString() contratMariage?: string;
  @IsOptional() @IsNumber() nbEnfants?: number;
  @IsOptional() @IsString() agesEnfants?: string;
  @IsOptional() @IsNumber() parts?: number;
  @IsOptional() proprietaireLogement?: boolean;
}

class SalarieDto {
  @IsOptional() @IsString() nom?: string;
  @IsOptional() @IsString() poste?: string;
  @IsOptional() @IsString() typeContrat?: string;
  @IsOptional() @IsNumber() age?: number;
  @IsOptional() @IsString() anciennete?: string;
}

class ReseauSocialDto {
  @IsOptional() @IsString() plateforme?: string;
  @IsOptional() @IsString() url?: string;
}

export class UpdateFicheIdentiteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() raisonSociale?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siren?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siret?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() formeJuridique?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adresse?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() surfaceCommerciale?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() activite?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emailContact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telephoneContact?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => GerantDto)
  gerants?: GerantDto[];

  @ApiPropertyOptional()
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SalarieDto)
  salaries?: SalarieDto[];

  @ApiPropertyOptional()
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActionnairesDto)
  actionnaires?: ActionnairesDto[];

  @ApiPropertyOptional() @IsOptional() @IsObject() honoraires?: Record<string, number>;

  @ApiPropertyOptional() @IsOptional() @IsString() siteWeb?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() reseauxSociaux?: string[];

  @ApiPropertyOptional()
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ReseauSocialDto)
  reseauxSociauxStructures?: ReseauSocialDto[];

  @ApiPropertyOptional() @IsOptional() @IsNumber() nbConcurrentsQuartier?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() nbConcurrentsCommune?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() nbConcurrentsGeneral?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() evolutionSecteur?: string;
}
