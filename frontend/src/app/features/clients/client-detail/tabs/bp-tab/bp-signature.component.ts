import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Zone de signature manuscrite (souris, doigt ou stylet sur tablette) pour la co-signature du
 * rapport BP avec le dirigeant (document client, partie 5). Émet l'image PNG, ou '' une fois effacée.
 */
@Component({
  selector: 'app-bp-signature',
  standalone: true,
  imports: [MatIconModule],
  template: `
<div class="sg" [class.sg--signee]="signee">
  <span class="sg__lib">{{ libelle }}</span>
  <canvas #toile class="sg__toile" width="560" height="200" [attr.aria-label]="'Zone de signature : ' + libelle"
          (pointerdown)="debut($event)" (pointermove)="trace($event)" (pointerup)="fin()" (pointerleave)="fin()"></canvas>
  @if (!signee) { <span class="sg__aide">Signez ici</span> }
  <button type="button" class="sg__effacer" (click)="effacer()" [disabled]="!signee"><mat-icon>backspace</mat-icon>Effacer</button>
</div>
  `,
  styles: [`
    :host { display: block; }
    .sg { position: relative; display: flex; flex-direction: column; gap: 6px; }
    .sg__lib { font-size: 12.5px; font-weight: 600; color: #334155; }
    .sg__toile { width: 100%; aspect-ratio: 14 / 5; border: 1.5px dashed #94a3b8; border-radius: 10px; background: #fff;
      touch-action: none; cursor: crosshair; }
    .sg--signee .sg__toile { border-style: solid; border-color: #0f766e; }
    .sg__aide { position: absolute; left: 50%; top: 55%; transform: translate(-50%, -50%); color: #cbd5e1; font-size: 15px;
      pointer-events: none; font-style: italic; }
    .sg__effacer { align-self: flex-end; display: inline-flex; align-items: center; gap: 4px; border: none; background: none;
      color: #64748b; font: inherit; font-size: 12px; cursor: pointer; }
    .sg__effacer:disabled { opacity: .4; cursor: default; }
    .sg__effacer mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `],
})
export class BpSignatureComponent implements AfterViewInit {
  @Input() libelle = 'Signature';
  @Output() signature = new EventEmitter<string>();
  @ViewChild('toile') toile!: ElementRef<HTMLCanvasElement>;

  signee = false;
  private ctx: CanvasRenderingContext2D | null = null;
  private enTrace = false;

  ngAfterViewInit() {
    this.ctx = this.toile.nativeElement.getContext('2d');
    if (this.ctx) { this.ctx.lineWidth = 2.6; this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round'; this.ctx.strokeStyle = '#0f172a'; }
  }

  private point(e: PointerEvent): [number, number] {
    const c = this.toile.nativeElement;
    const r = c.getBoundingClientRect();
    return [(e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)];
  }

  debut(e: PointerEvent) {
    if (!this.ctx) return;
    this.enTrace = true;
    this.toile.nativeElement.setPointerCapture?.(e.pointerId);
    const [x, y] = this.point(e);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x + 0.1, y + 0.1);
    this.ctx.stroke();
  }

  trace(e: PointerEvent) {
    if (!this.enTrace || !this.ctx) return;
    const [x, y] = this.point(e);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  fin() {
    if (!this.enTrace) return;
    this.enTrace = false;
    this.signee = true;
    this.signature.emit(this.toile.nativeElement.toDataURL('image/png'));
  }

  effacer() {
    const c = this.toile.nativeElement;
    this.ctx?.clearRect(0, 0, c.width, c.height);
    this.signee = false;
    this.signature.emit('');
  }
}
