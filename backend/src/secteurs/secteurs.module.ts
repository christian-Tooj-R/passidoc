import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Secteur } from '../entities/secteur.entity';
import { SecteursService } from './secteurs.service';
import { SecteursController } from './secteurs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Secteur])],
  controllers: [SecteursController],
  providers: [SecteursService],
  exports: [SecteursService],
})
export class SecteursModule {}
