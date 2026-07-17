import { IsEmail, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserAntenne, UserRole, UserSite } from '../../entities/user.entity';

export class CreateUserDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
  @ApiProperty({ enum: UserRole }) @IsEnum(UserRole) role: UserRole;
  @ApiProperty({ enum: UserSite }) @IsEnum(UserSite) site: UserSite;

  @ApiPropertyOptional({ enum: UserAntenne }) @IsOptional() @IsEnum(UserAntenne) antenne?: UserAntenne;
  @ApiPropertyOptional() @IsOptional() @IsInt() referentId?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() poste?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() typeContrat?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateEntree?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateSortie?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telephone?: string;
}
