import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantConfig } from '../entities/tenant-config.entity';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { TenantMiddleware } from './tenant.middleware';

@Module({
  imports: [TypeOrmModule.forFeature([TenantConfig])],
  providers: [TenantService, TenantMiddleware],
  controllers: [TenantController],
  exports: [TenantService, TenantMiddleware],
})
export class TenantModule {}
