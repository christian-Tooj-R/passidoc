import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ToastService } from '../../../../../core/services/toast.service';
import { ControleInterneService } from '../../../../../core/services/controle-interne.service';

@Component({
  selector: 'app-controle-interne-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="tab">
      <div class="tab-header">
        <h2>Contrôle Interne & Pilotage</h2>
        <button mat-flat-button color="primary" (click)="save()">
          <mat-icon>save</mat-icon> Enregistrer
        </button>
      </div>

      <!-- Process OK -->
      <div class="section">
        <div class="section-header section-header--green">
          <mat-icon>check_circle</mat-icon>
          <span>Process qui fonctionnent bien</span>
          <button mat-icon-button (click)="addProcessOk()"><mat-icon>add</mat-icon></button>
        </div>
        @for (p of processOk; track $index) {
          <div class="process-row process-row--green">
            <input class="process-input" [(ngModel)]="p.description" placeholder="Description du process..." />
            <input class="process-input" [(ngModel)]="p.raison" placeholder="Pourquoi ça fonctionne..." />
            <button mat-icon-button (click)="removeProcessOk($index)"><mat-icon>remove_circle_outline</mat-icon></button>
          </div>
        }
        @if (processOk.length === 0) {
          <p class="empty-hint">Cliquez sur + pour ajouter un process</p>
        }
      </div>

      <!-- Process défaillants -->
      <div class="section">
        <div class="section-header section-header--red">
          <mat-icon>cancel</mat-icon>
          <span>Process qui font défaut</span>
          <button mat-icon-button (click)="addProcessKo()"><mat-icon>add</mat-icon></button>
        </div>
        @for (p of processKo; track $index) {
          <div class="process-row process-row--red">
            <input class="process-input" [(ngModel)]="p.description" placeholder="Description du process..." />
            <input class="process-input" [(ngModel)]="p.raison" placeholder="Pourquoi ça échoue..." />
            <input class="process-input" [(ngModel)]="p.risques" placeholder="Risques associés..." />
            <button mat-icon-button (click)="removeProcessKo($index)"><mat-icon>remove_circle_outline</mat-icon></button>
          </div>
        }
        @if (processKo.length === 0) {
          <p class="empty-hint">Cliquez sur + pour ajouter un process défaillant</p>
        }
      </div>

      <!-- Outils de pilotage -->
      <div class="section">
        <div class="section-header section-header--blue">
          <mat-icon>settings</mat-icon>
          <span>Outils & modes de pilotage du client</span>
          <button mat-icon-button (click)="addOutil()"><mat-icon>add</mat-icon></button>
        </div>
        @for (o of outils; track $index) {
          <div class="process-row process-row--blue">
            <input class="process-input" [(ngModel)]="o.nom" placeholder="Nom de l'outil (ex: Tiime Apps)" />
            <input class="process-input flex-2" [(ngModel)]="o.description" placeholder="Description de l'usage..." />
            <button mat-icon-button (click)="removeOutil($index)"><mat-icon>remove_circle_outline</mat-icon></button>
          </div>
        }
        @if (outils.length === 0) {
          <p class="empty-hint">Cliquez sur + pour ajouter un outil</p>
        }
      </div>

      <!-- Note générale -->
      <div class="section">
        <div class="section-header section-header--gray">
          <mat-icon>notes</mat-icon>
          <span>Note générale</span>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <textarea matInput rows="4" [(ngModel)]="noteGenerale"
            placeholder="Observations générales sur l'organisation interne..."></textarea>
        </mat-form-field>
      </div>
    </div>
  `,
  styles: [`
    .tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .tab-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; }
    .section { margin-bottom: 24px; }
    .section-header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 16px; border-radius: 10px 10px 0 0;
      font-size: 14px; font-weight: 600; margin-bottom: 8px;
    }
    .section-header mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .section-header span { flex: 1; }
    .section-header button { color: inherit !important; width: 28px !important; height: 28px !important; }
    .section-header--green { background: #dcfce7; color: #15803d; }
    .section-header--red { background: #fee2e2; color: #dc2626; }
    .section-header--blue { background: #dbeafe; color: #1d4ed8; }
    .section-header--gray { background: #f1f5f9; color: #475569; }

    .process-row {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; border-radius: 8px; margin-bottom: 6px;
      border: 1px solid rgba(0,0,0,0.06);
    }
    .process-row--green { background: #f0fdf4; }
    .process-row--red { background: #fef2f2; }
    .process-row--blue { background: #eff6ff; }
    .process-input {
      flex: 1; border: none; background: transparent;
      font-size: 13px; padding: 4px 8px; border-radius: 6px;
      font-family: inherit; color: #1e293b;
    }
    .process-input:focus { outline: 1px solid #6366f1; background: white; }
    .flex-2 { flex: 2 !important; }
    .full-width { width: 100%; }
    .empty-hint { font-size: 13px; color: #94a3b8; padding: 8px 12px; margin: 0; }
  `],
})
export class ControleInterneTabComponent implements OnInit {
  @Input() clientId!: number;
  private service = inject(ControleInterneService);
  private toast = inject(ToastService);

  processOk: { description: string; raison: string }[] = [];
  processKo: { description: string; raison: string; risques: string }[] = [];
  outils: { nom: string; description: string }[] = [];
  noteGenerale = '';

  ngOnInit() {
    this.service.get(this.clientId).subscribe(data => {
      if (data) {
        this.processOk = data.processOk || [];
        this.processKo = data.processDefaillants || [];
        this.outils = data.outilsPilotage || [];
        this.noteGenerale = data.noteGenerale || '';
      }
    });
  }

  addProcessOk() { this.processOk.push({ description: '', raison: '' }); }
  removeProcessOk(i: number) { this.processOk.splice(i, 1); }

  addProcessKo() { this.processKo.push({ description: '', raison: '', risques: '' }); }
  removeProcessKo(i: number) { this.processKo.splice(i, 1); }

  addOutil() { this.outils.push({ nom: '', description: '' }); }
  removeOutil(i: number) { this.outils.splice(i, 1); }

  save() {
    this.service.save(this.clientId, {
      processOk: this.processOk,
      processDefaillants: this.processKo,
      outilsPilotage: this.outils,
      noteGenerale: this.noteGenerale,
    }).subscribe(() => {
      this.toast.success('Contrôle interne enregistré');
    });
  }
}
