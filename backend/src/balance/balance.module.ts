import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceMensuelle } from '../entities/balance-mensuelle.entity';
import { Document } from '../entities/document.entity';
import { BalanceService } from './balance.service';
import { BalanceController } from './balance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BalanceMensuelle, Document])],
  controllers: [BalanceController],
  providers: [BalanceService],
})
export class BalanceModule {}
