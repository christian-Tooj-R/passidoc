import { IsEnum, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TypeFlux, StatutDepot } from '../../entities/flux-mensuel.entity';

export class CreateFluxDto {
  @ApiProperty({ enum: TypeFlux }) @IsEnum(TypeFlux) type: TypeFlux;
  @ApiProperty() @IsInt() @Min(1) @Max(12) mois: number;
  @ApiProperty() @IsInt() annee: number;
  @ApiPropertyOptional({ enum: StatutDepot }) @IsOptional() @IsEnum(StatutDepot) statut?: StatutDepot;
  @ApiPropertyOptional() @IsOptional() @IsString() commentaire?: string;
}
