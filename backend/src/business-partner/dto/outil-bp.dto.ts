import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** Le contenu est reconstruit champ par champ selon l'outil (normaliserContenu). */
export class EnregistrerOutilBpDto {
  @ApiProperty({ description: "Contenu de l'outil (structure propre à chaque outil)" })
  @IsObject({ message: "Le contenu de l'outil est requis" })
  contenu: Record<string, any>;
}

export class ValiderOutilBpDto {
  @ApiPropertyOptional({ description: 'Commentaire du BP joint à la validation' })
  @IsOptional() @IsString() @MaxLength(1000, { message: 'Commentaire limité à 1000 caractères' })
  commentaire?: string;
}
