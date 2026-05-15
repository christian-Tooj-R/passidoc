import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ToastComponent, ToastData } from '../components/toast.component';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private snack = inject(MatSnackBar);

  private show(message: string, type: ToastData['type'], duration = 3000) {
    this.snack.openFromComponent(ToastComponent, {
      data: { message, type } satisfies ToastData,
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
      panelClass: 'toast-panel',
    });
  }

  success(message: string) { this.show(message, 'success'); }
  error(message: string)   { this.show(message, 'error', 4000); }
  warning(message: string) { this.show(message, 'warning'); }
  info(message: string)    { this.show(message, 'info'); }
}
