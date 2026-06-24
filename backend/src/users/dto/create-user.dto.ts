import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserSite } from '../../entities/user.entity';

export class CreateUserDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
  @ApiProperty({ enum: UserRole }) @IsEnum(UserRole) role: UserRole;
  @ApiProperty({ enum: UserSite }) @IsEnum(UserSite) site: UserSite;

  @ApiPropertyOptional() @IsOptional() @IsString() poste?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() typeContrat?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateEntree?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateSortie?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telephone?: string;
}
