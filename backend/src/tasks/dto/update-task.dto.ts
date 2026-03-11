import { IsString, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatut, TaskPriorite, TaskType } from '../../entities/task.entity';

export class UpdateTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() titre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskStatut) statut?: TaskStatut;
  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskPriorite) priorite?: TaskPriorite;
  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskType) type?: TaskType;
  @ApiPropertyOptional() @IsOptional() @IsString() dateEcheance?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() assigneeId?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() semaine?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() tempsExecution?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() heuresSup?: number;
}
