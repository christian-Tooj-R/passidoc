import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name);

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async onApplicationBootstrap() {
    try {
      const result = await this.dataSource.query(
        `DELETE FROM flux_mensuels WHERE type IS NULL`,
      );
      const count = result?.rowCount ?? result?.affectedRows ?? 0;
      if (count > 0) this.logger.log(`Nettoyage : ${count} flux_mensuels sans type supprimés`);
    } catch (e) {
      this.logger.warn(`Nettoyage flux_mensuels ignoré : ${e.message}`);
    }
  }

  getHello(): string {
    return 'Hello World!';
  }
}
