import { IsString, IsNumber, IsOptional, IsArray, IsObject, ValidateNested, IsEmail, IsIn, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { APPROCHES_CLIENT } from '../relation-client';

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

class ContactOperationnelDto {
  @IsOptional() @IsString() nom?: string;
  @IsOptional() @IsString() poste?: string;
  @IsOptional() @IsString() telephone?: string;
  @ValidateIf((o) => !!o.email) @IsEmail({}, { message: 'E-mail du contact opérationnel invalide' }) email?: string;
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

  // ── Évolutions v2 #2 / #3 ──
  @ApiPropertyOptional() @IsOptional() @IsString() contactLegalNom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactLegalFonction?: string;

  @ApiPropertyOptional()
  @IsOptional() @ValidateNested() @Type(() => ContactOperationnelDto)
  contactOperationnel?: ContactOperationnelDto;

  @ApiPropertyOptional({ enum: APPROCHES_CLIENT })
  @IsOptional() @IsIn(APPROCHES_CLIENT as unknown as string[], { message: 'Approche client inconnue' })
  approcheClient?: string;

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
  @ApiPropertyOptional() @IsOptional() organigramme?: object | object[] | null;

  // ── TACHE-03 ──
  @ApiPropertyOptional() @IsOptional() @IsString() activitePrincipale?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() typeClientele?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() saisonnalite?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pointsDeVente?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() photos?: string[];

  // ── TACHE-04 ──
  @ApiPropertyOptional() @IsOptional() @IsObject() cycleTresorerie?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsObject() cycleAchats?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsObject() cycleVentes?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsObject() cycleChargesPaie?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsString() pointsVigilance?: string;

  // champs existants non couverts
  @ApiPropertyOptional() @IsOptional() @IsString() dateCreation?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() capital?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() entrepriseFamiliale?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() reglementations?: string[];
}
