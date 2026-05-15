import { IsOptional, IsString, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQuestionnaireSectorielDto {
  @ApiPropertyOptional() @IsOptional() @IsString() secteur?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() reponses?: Record<string, any>;
}
