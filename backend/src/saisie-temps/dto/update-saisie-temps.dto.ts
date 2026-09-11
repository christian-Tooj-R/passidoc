import { PartialType } from '@nestjs/swagger';
import { CreateSaisieTempsDto } from './create-saisie-temps.dto';

export class UpdateSaisieTempsDto extends PartialType(CreateSaisieTempsDto) {}
