import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      // AppService nettoie flux_mensuels au démarrage via la DataSource : simulée ici.
      providers: [AppService, { provide: DataSource, useValue: { query: jest.fn().mockResolvedValue({ rowCount: 0 }) } }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('nettoyage au démarrage', () => {
    it('supprime les flux mensuels sans type et ne bloque jamais le démarrage', async () => {
      const query = jest.fn().mockRejectedValue(new Error('table absente'));
      const app: TestingModule = await Test.createTestingModule({
        providers: [AppService, { provide: DataSource, useValue: { query } }],
      }).compile();
      await expect(app.get(AppService).onApplicationBootstrap()).resolves.toBeUndefined();
      expect(query).toHaveBeenCalledWith('DELETE FROM flux_mensuels WHERE type IS NULL');
    });
  });
});
