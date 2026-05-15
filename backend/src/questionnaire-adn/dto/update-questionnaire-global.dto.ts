import { IsOptional, IsString, IsArray, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQuestionnaireGlobalDto {
  @ApiPropertyOptional() @IsOptional() @IsString() mission?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() visionActivite?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() valeurCle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() placeExploitation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ambianceEquipe?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() enjeuxRH?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() canauxAcquisition?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() principalConcurrent?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() saisonnalite?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() caillouChaussure?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() projetsInvestissement?: string[];
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(5) niveauNumerique?: number;
}
