import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SecteurQuestion } from '../../entities/secteur.entity';

export class CreateSecteurDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() label: string;
  @ApiPropertyOptional() @IsOptional() @IsString() icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() codeNaf?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() codeNafLibelle?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @Type(() => Object) questions?: SecteurQuestion[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateSecteurDto {
  @ApiPropertyOptional() @IsOptional() @IsString() label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() codeNaf?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() codeNafLibelle?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @Type(() => Object) questions?: SecteurQuestion[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
