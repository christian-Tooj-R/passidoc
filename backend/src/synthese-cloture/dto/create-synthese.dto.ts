import { IsInt, IsOptional, IsString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSyntheseCloture {
  @ApiProperty() @IsInt() exercice: number;
  @ApiPropertyOptional() @IsOptional() @IsString() pointsIS?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pointsEBE?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notesSynthese?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() businessModel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() strategieVente?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() canauxDistribution?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() zonesExoneration?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() zonesRisque?: string[];
}
