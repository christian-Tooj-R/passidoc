import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TacheRecurrenteService } from './tache-recurrente.service';

@Injectable()
export class TacheRecurrenteCronService {
  private readonly logger = new Logger(TacheRecurrenteCronService.name);

  constructor(private service: TacheRecurrenteService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async genererTachesQuotidien() {
    this.logger.log('Génération des tâches récurrentes...');
    const created = await this.service.genererTachesEcheances();
    this.logger.log(`${created} tâche(s) récurrente(s) générée(s)`);
  }
}
