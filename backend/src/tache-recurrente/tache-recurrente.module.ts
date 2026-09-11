import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TacheRecurrente } from '../entities/tache-recurrente.entity';
import { Task } from '../entities/task.entity';
import { TacheRecurrenteService } from './tache-recurrente.service';
import { TacheRecurrenteController } from './tache-recurrente.controller';
import { TacheRecurrenteCronService } from './tache-recurrente-cron.service';

@Module({
  imports: [TypeOrmModule.forFeature([TacheRecurrente, Task])],
  controllers: [TacheRecurrenteController],
  providers: [TacheRecurrenteService, TacheRecurrenteCronService],
  exports: [TacheRecurrenteService],
})
export class TacheRecurrenteModule {}
