import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TenantConfig } from '../entities/tenant-config.entity';
import { User } from '../entities/user.entity';
import { SetupService } from './setup.service';
import { SetupController } from './setup.controller';
import { SecteursModule } from '../secteurs/secteurs.module';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([TenantConfig, User]), SecteursModule],
  providers: [SetupService],
  controllers: [SetupController],
})
export class SetupModule {}
