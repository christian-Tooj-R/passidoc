import { IsEnum, IsInt, IsOptional, IsString, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatutDepot } from '../../entities/flux-mensuel.entity';

export class CreateFluxDto {
  @ApiProperty() @IsString() @MaxLength(100) type: string;
  @ApiProperty() @IsInt() @Min(1) @Max(12) mois: number;
  @ApiProperty() @IsInt() annee: number;
  @ApiPropertyOptional({ enum: StatutDepot }) @IsOptional() @IsEnum(StatutDepot) statut?: StatutDepot;
  @ApiPropertyOptional() @IsOptional() @IsString() commentaire?: string;
}
