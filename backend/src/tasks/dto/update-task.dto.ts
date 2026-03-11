import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatut, TaskPriorite } from '../../entities/task.entity';

export class UpdateTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() titre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskStatut) statut?: TaskStatut;
  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskPriorite) priorite?: TaskPriorite;
  @ApiPropertyOptional() @IsOptional() @IsString() dateEcheance?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() assigneeId?: number;
}
