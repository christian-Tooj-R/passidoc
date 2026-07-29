import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SetupService } from './setup.service';
import { SetupDto } from './setup.dto';

@ApiTags('Setup')
@Controller('setup')
export class SetupController {
  constructor(private setupService: SetupService) {}

  @Get('status')
  @ApiOperation({ summary: 'Vérifie si l\'application a déjà été configurée (public)' })
  getStatus() {
    return this.setupService.getStatus();
  }

  @Post()
  @ApiOperation({ summary: 'Effectue la configuration initiale de l\'application (public)' })
  setup(@Body() dto: SetupDto) {
    return this.setupService.setup(dto);
  }
}
