import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FluxMensuelService } from '../../../../../core/services/flux-mensuel.service';
import { FluxMensuel } from '../../../../../core/models/client.model';

@Component({
  selector: 'app-flux-mensuel-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatTableModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatChipsModule, MatSnackBarModule,
  ],
  template: `
    <div class="tab-content">
      <div class="tab-content__header">
        <h3>Suivi des flux mensuels</h3>
        <div class="alertes" *ngIf="alertes.length > 0">
          <mat-chip color="warn">⚠ {{ alertes.length }} flux manquants ou en retard</mat-chip>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="addFlux()" class="add-form">
        <mat-form-field appearance="outline">
          <mat-label>Type</mat-label>
          <mat-select formControlName="type">
            <mat-option value="RELEVE_BANCAIRE">Relevé bancaire</mat-option>
            <mat-option value="RAPPORT_VENTE">Rapport de vente</mat-option>
            <mat-option value="RAPPORT_REGLEMENT">Rapport de règlement</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Mois</mat-label>
          <mat-select formControlName="mois">
            @for (m of mois; track m.val) {
              <mat-option [value]="m.val">{{ m.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Année</mat-label>
          <input matInput type="number" formControlName="annee" />
        </mat-form-field>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
          <mat-icon>add</mat-icon> Ajouter
        </button>
      </form>

      <table mat-table [dataSource]="fluxList" class="full-width">
        <ng-container matColumnDef="type">
          <th mat-header-cell *matHeaderCellDef>Type</th>
          <td mat-cell *matCellDef="let f">{{ typeLabel(f.type) }}</td>
        </ng-container>
        <ng-container matColumnDef="periode">
          <th mat-header-cell *matHeaderCellDef>Période</th>
          <td mat-cell *matCellDef="let f">{{ moisLabel(f.mois) }} {{ f.annee }}</td>
        </ng-container>
        <ng-container matColumnDef="statut">
          <th mat-header-cell *matHeaderCellDef>Statut</th>
          <td mat-cell *matCellDef="let f">
            <mat-chip [color]="statutColor(f.statut)" selected>{{ f.statut }}</mat-chip>
          </td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let f">
            @if (f.statut !== 'DEPOSE') {
              <button mat-icon-button color="primary" (click)="marquerDepose(f)" matTooltip="Marquer comme déposé">
                <mat-icon>check_circle</mat-icon>
              </button>
            }
            <button mat-icon-button color="warn" (click)="delete(f)">
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns;"></tr>
      </table>
    </div>
  `,
  styles: [`
    .tab-content { padding: 24px; }
    .tab-content__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .add-form { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; }
    .full-width { width: 100%; }
  `],
})
export class FluxMensuelTabComponent implements OnInit {
  private fb = inject(FormBuilder);
  @Input() clientId!: number;
  fluxList: FluxMensuel[] = [];
  alertes: FluxMensuel[] = [];
  columns = ['type', 'periode', 'statut', 'actions'];
  mois = [
    { val: 1, label: 'Janvier' }, { val: 2, label: 'Février' }, { val: 3, label: 'Mars' },
    { val: 4, label: 'Avril' }, { val: 5, label: 'Mai' }, { val: 6, label: 'Juin' },
    { val: 7, label: 'Juillet' }, { val: 8, label: 'Août' }, { val: 9, label: 'Septembre' },
    { val: 10, label: 'Octobre' }, { val: 11, label: 'Novembre' }, { val: 12, label: 'Décembre' },
  ];

  form = this.fb.group({
    type: ['', Validators.required],
    mois: [null as number | null, Validators.required],
    annee: [new Date().getFullYear(), Validators.required],
  });

  constructor(private service: FluxMensuelService, private snack: MatSnackBar) {}

  ngOnInit() { this.load(); }

  load() {
    this.service.getAll(this.clientId).subscribe((d) => (this.fluxList = d));
    this.service.getAlertes(this.clientId).subscribe((d) => (this.alertes = d));
  }

  addFlux() {
    this.service.create(this.clientId, this.form.value).subscribe(() => {
      this.load();
      this.form.reset({ annee: new Date().getFullYear() });
      this.snack.open('Flux ajouté', 'OK', { duration: 2000 });
    });
  }

  marquerDepose(flux: FluxMensuel) {
    this.service.update(this.clientId, flux.id, { statut: 'DEPOSE' }).subscribe(() => this.load());
  }

  delete(flux: FluxMensuel) {
    this.service.delete(this.clientId, flux.id).subscribe(() => this.load());
  }

  typeLabel(t: string) {
    const map: any = { RELEVE_BANCAIRE: 'Relevé bancaire', RAPPORT_VENTE: 'Rapport vente', RAPPORT_REGLEMENT: 'Rapport règlement' };
    return map[t] || t;
  }
  moisLabel(m: number) { return this.mois.find((x) => x.val === m)?.label || m; }
  statutColor(s: string) { return s === 'DEPOSE' ? 'primary' : 'warn'; }
}
