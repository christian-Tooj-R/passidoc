import { IsEnum, IsString, IsOptional, IsObject, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ClientSite } from '../../entities/client.entity';
import { TypeFlux } from '../../entities/flux-mensuel.entity';

export class CreateClientDto {
  @ApiProperty() @IsString() nom: string;
  @ApiProperty({ enum: ClientSite }) @IsEnum(ClientSite) site: ClientSite;
  @ApiPropertyOptional() @IsOptional() @IsString() dateClotureExercice?: string; // "MM-DD"
  @ApiPropertyOptional() @IsOptional() @IsString() secteurActivite?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @Transform(({ obj, key }) => (obj as any)[key]) typesFluxActifs?: TypeFlux[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @Transform(({ obj, key }) => (obj as any)[key]) customFluxTypes?: { key: string; label: string }[];
  @ApiPropertyOptional() @IsOptional() @IsObject() ficheData?: {
    raisonSociale?: string;
    siren?: string;
    siret?: string;
    formeJuridique?: string;
    adresse?: string;
    gerants?: { nom: string; qualite: string }[];
  };
}
