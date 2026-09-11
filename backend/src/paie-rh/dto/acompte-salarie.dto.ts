import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateAcompteSalarieDto {
  @IsNumber() salarieId: number;
  @IsInt() @Min(1) @Max(12) periodeMois: number;
  @IsInt() periodeAnnee: number;
  @IsNumber() @Min(0) montant: number;
  @IsString() @IsOptional() dateDemande?: string;
  @IsString() @IsOptional() motif?: string;
}
