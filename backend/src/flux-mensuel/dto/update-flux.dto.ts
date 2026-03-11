import { PartialType } from '@nestjs/swagger';
import { CreateFluxDto } from './create-flux.dto';

export class UpdateFluxDto extends PartialType(CreateFluxDto) {}
