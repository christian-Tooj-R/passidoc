import { Directive, HostListener, Input } from '@angular/core';

/**
 * Bloque la saisie de lettres dans un <input type="number">.
 * Les navigateurs laissent passer 'e', 'E', '+' (notation scientifique).
 * Avec [allowNegative]="false" (défaut), '-' est aussi bloqué.
 * Usage : <input matInput type="number" onlyNumbers />
 *         <input matInput type="number" onlyNumbers [allowNegative]="true" />
 */
@Directive({
  selector: 'input[type="number"]',
  standalone: true,
})
export class OnlyNumbersDirective {
  @Input() allowNegative = false;
  @Input() allowDecimal  = true;

  private readonly ALLOWED_KEYS = new Set([
    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Home', 'End',
  ]);

  @HostListener('keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey) return; // Ctrl+C, Ctrl+V, etc.
    if (this.ALLOWED_KEYS.has(e.key)) return;
    if (e.key >= '0' && e.key <= '9') return;
    if (this.allowNegative && e.key === '-') return;
    if (this.allowDecimal && (e.key === '.' || e.key === ',')) return;
    e.preventDefault();
  }

  @HostListener('paste', ['$event'])
  onPaste(e: ClipboardEvent): void {
    const text = e.clipboardData?.getData('text') ?? '';
    const pattern = this.allowDecimal ? /[^0-9.,\-]/ : /[^0-9\-]/;
    if (pattern.test(text) || (!this.allowNegative && text.includes('-'))) {
      e.preventDefault();
    }
  }
}
