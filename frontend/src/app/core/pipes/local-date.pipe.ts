import { Pipe, PipeTransform, inject } from '@angular/core';
import { formatInTimeZone } from 'date-fns-tz';
import { AuthService } from '../services/auth.service';

@Pipe({ name: 'localDate', standalone: true })
export class LocalDatePipe implements PipeTransform {
  private auth = inject(AuthService);

  transform(value: string | Date | null | undefined, format = 'dd/MM/yyyy HH:mm'): string {
    if (!value) return '—';
    // Repli sur le fuseau du navigateur plutôt qu'un fuseau géographique codé en dur.
    const tz = (this.auth.currentUser() as any)?.timezone
      || Intl.DateTimeFormat().resolvedOptions().timeZone
      || 'UTC';
    try {
      return formatInTimeZone(new Date(value), tz, format);
    } catch {
      return String(value).slice(0, 16).replace('T', ' ');
    }
  }
}
