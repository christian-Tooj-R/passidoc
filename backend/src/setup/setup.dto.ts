import { IsString, IsEmail, MinLength, IsOptional, Matches } from 'class-validator';

export class SetupDto {
  @IsString() @MinLength(2) @Matches(/^[a-z0-9-]+$/, { message: 'Le slug ne doit contenir que des lettres minuscules, chiffres ou tirets' })
  slug: string;

  @IsString() @MinLength(2)
  nomSociete: string;

  @IsOptional() @IsString()
  logoUrl?: string;

  @IsOptional() @IsString()
  slogan?: string;

  @IsOptional() @IsString()
  ville?: string;

  @IsOptional() @IsString()
  pays?: string;

  @IsOptional() @IsString()
  poleLabel1?: string;

  @IsOptional() @IsString()
  poleLabel2?: string;

  @IsOptional() @IsString()
  poleFlag1?: string;

  @IsOptional() @IsString()
  poleFlag2?: string;

  @IsString() @MinLength(1)
  adminFirstName: string;

  @IsString() @MinLength(1)
  adminLastName: string;

  @IsEmail()
  adminEmail: string;

  @IsString() @MinLength(8)
  adminPassword: string;
}
