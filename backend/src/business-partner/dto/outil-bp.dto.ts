import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/** Le contenu est reconstruit champ par champ selon l'outil (normaliserContenu). */
export class EnregistrerOutilBpDto {
  @ApiProperty({ description: "Contenu de l'outil (structure propre à chaque outil)" })
  @IsObject({ message: "Le contenu de l'outil est requis" })
  contenu: Record<string, any>;
}
