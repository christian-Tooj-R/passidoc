import { Pipe, PipeTransform, inject } from '@angular/core';
import { formatInTimeZone } from 'date-fns-tz';
import { AuthService } from '../services/auth.service';

@Pipe({ name: 'localDate', standalone: true })
export class LocalDatePipe implements PipeTransform {
  private auth = inject(AuthService);

  transform(value: string | Date | null | undefined, format = 'dd/MM/yyyy HH:mm'): string {
    if (!value) return '—';
    const tz = (this.auth.currentUser() as any)?.timezone || 'Indian/Reunion';
    try {
      return formatInTimeZone(new Date(value), tz, format);
    } catch {
      return String(value).slice(0, 16).replace('T', ' ');
    }
  }
}
