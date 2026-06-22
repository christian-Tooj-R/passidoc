import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Salarie } from '../entities/salarie.entity';
import { SalariesController } from './salaries.controller';
import { SalariesService } from './salaries.service';

@Module({
  imports: [TypeOrmModule.forFeature([Salarie])],
  controllers: [SalariesController],
  providers: [SalariesService],
  exports: [SalariesService],
})
export class SalariesModule {}
