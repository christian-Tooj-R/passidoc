import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriorite, TaskType } from '../../entities/task.entity';

export class CreateTaskDto {
  @ApiProperty() @IsString() titre: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskPriorite) priorite?: TaskPriorite;
  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskType) type?: TaskType;
  @ApiPropertyOptional() @IsOptional() @IsString() dateEcheance?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() assigneeId?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() semaine?: number;
}
