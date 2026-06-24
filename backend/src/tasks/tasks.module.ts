import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { TaskCommentsService } from './task-comments.service';
import { TasksController } from './tasks.controller';
import { AllTasksController } from './tasks-global.controller';
import { Task } from '../entities/task.entity';
import { TaskComment } from '../entities/task-comment.entity';
import { User } from '../entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskComment, User]), NotificationsModule],
  controllers: [TasksController, AllTasksController],
  providers: [TasksService, TaskCommentsService],
})
export class TasksModule {}
