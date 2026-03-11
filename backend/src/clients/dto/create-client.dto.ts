import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ClientSite } from '../../entities/client.entity';

export class CreateClientDto {
  @ApiProperty() @IsString() nom: string;
  @ApiProperty({ enum: ClientSite }) @IsEnum(ClientSite) site: ClientSite;
}
