import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';

export interface ToastData {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

const CONFIG = {
  success: { icon: 'check_circle',        bg: '#22c55e', color: '#fff' },
  error:   { icon: 'error',               bg: '#ef4444', color: '#fff' },
  warning: { icon: 'warning_amber',       bg: '#f59e0b', color: '#fff' },
  info:    { icon: 'info',                bg: '#3b82f6', color: '#fff' },
};

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="toast-wrap" [style.background]="cfg.bg">
      <mat-icon class="toast-icon">{{ cfg.icon }}</mat-icon>
      <span class="toast-msg">{{ data.message }}</span>
      <button class="toast-close" (click)="ref.dismiss()">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .toast-wrap {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; border-radius: 12px;
      min-width: 260px; max-width: 380px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }
    .toast-icon {
      font-size: 20px; width: 20px; height: 20px;
      color: #fff; flex-shrink: 0;
    }
    .toast-msg {
      flex: 1; font-size: 13px; font-weight: 500;
      color: #fff; font-family: 'Inter', sans-serif;
      line-height: 1.4;
    }
    .toast-close {
      background: none; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; border-radius: 6px;
      padding: 0; flex-shrink: 0;
      opacity: 0.75; transition: opacity .15s;
    }
    .toast-close:hover { opacity: 1; }
    .toast-close mat-icon {
      font-size: 16px; width: 16px; height: 16px; color: #fff;
    }
  `],
})
export class ToastComponent {
  data   = inject<ToastData>(MAT_SNACK_BAR_DATA);
  ref    = inject(MatSnackBarRef);
  cfg    = CONFIG[this.data.type];
}
