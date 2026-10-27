import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Relance relue (et éventuellement retouchée) par le collaborateur avant envoi. */
export class EnvoyerRelanceDto {
  @IsOptional() @IsString() @MaxLength(200)
  objet?: string;

  @IsOptional() @IsString() @MaxLength(8000)
  texte?: string;
}
