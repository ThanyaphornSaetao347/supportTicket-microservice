import { Test, TestingModule } from '@nestjs/testing';
<<<<<<< HEAD
import { AppController } from './app.controller';
import { AppService } from './app.service';
=======
import { AppController } from './gateway.controller';
import { AppService } from './gateway.service';
>>>>>>> e9c5035 (API Gateway)

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
