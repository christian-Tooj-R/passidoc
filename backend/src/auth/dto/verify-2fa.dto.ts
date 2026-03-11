import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Verify2faDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  token: string;
}
