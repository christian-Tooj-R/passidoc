import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { AllTasksController } from './tasks-global.controller';
import { Task } from '../entities/task.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Task]), NotificationsModule],
  controllers: [TasksController, AllTasksController],
  providers: [TasksService],
})
export class TasksModule {}
