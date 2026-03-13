import { IsEnum, IsString, IsOptional, IsObject, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientSite } from '../../entities/client.entity';
import { TypeFlux } from '../../entities/flux-mensuel.entity';

export class CreateClientDto {
  @ApiProperty() @IsString() nom: string;
  @ApiProperty({ enum: ClientSite }) @IsEnum(ClientSite) site: ClientSite;
  @ApiPropertyOptional() @IsOptional() @IsArray() typesFluxActifs?: TypeFlux[];
  @ApiPropertyOptional() @IsOptional() @IsObject() ficheData?: {
    raisonSociale?: string;
    siren?: string;
    siret?: string;
    formeJuridique?: string;
    adresse?: string;
    gerants?: { nom: string; qualite: string }[];
  };
}
