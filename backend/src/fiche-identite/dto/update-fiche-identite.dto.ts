import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
  @ApiPropertyOptional() @IsOptional() @IsArray() gerants?: any[];
  @ApiPropertyOptional() @IsOptional() @IsArray() salaries?: any[];
}
