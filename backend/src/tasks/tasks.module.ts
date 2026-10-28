import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { TaskCommentsService } from './task-comments.service';
import { TasksScheduler } from './tasks.scheduler';
import { TasksController } from './tasks.controller';
import { AllTasksController } from './tasks-global.controller';
import { Task } from '../entities/task.entity';
import { TaskComment } from '../entities/task-comment.entity';
import { User } from '../entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SaisieTempsModule } from '../saisie-temps/saisie-temps.module';

@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskComment, User]), NotificationsModule, SaisieTempsModule],
  controllers: [TasksController, AllTasksController],
  providers: [TasksService, TaskCommentsService, TasksScheduler],
})
export class TasksModule {}
