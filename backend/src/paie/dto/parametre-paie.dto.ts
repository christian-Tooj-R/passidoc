import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateParametrePaieDto {
  @IsString() code: string;
  @IsString() libelle: string;
  @IsString() @IsOptional() regimePaieCode?: string;
  @IsNumber() valeur: number;
  @IsString() @IsOptional() notes?: string;
}

export class UpdateParametrePaieDto {
  @IsString() @IsOptional() libelle?: string;
  @IsString() @IsOptional() regimePaieCode?: string;
  @IsNumber() @IsOptional() valeur?: number;
  @IsString() @IsOptional() notes?: string;
}
