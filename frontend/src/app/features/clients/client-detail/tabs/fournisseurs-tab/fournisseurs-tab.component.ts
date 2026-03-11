import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FournisseursService } from '../../../../../core/services/fournisseurs.service';
import { Fournisseur } from '../../../../../core/models/client.model';

@Component({
  selector: 'app-fournisseurs-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatTableModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule, MatSnackBarModule,
  ],
  template: `
    <div class="tab-content">
      <h3>Annuaire fournisseurs</h3>

      <form [formGroup]="form" (ngSubmit)="add()" class="add-form">
        <mat-form-field appearance="outline">
          <mat-label>Nom</mat-label>
          <input matInput formControlName="nom" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Téléphone</mat-label>
          <input matInput formControlName="telephone" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Catégorie</mat-label>
          <input matInput formControlName="categorie" />
        </mat-form-field>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
          <mat-icon>add</mat-icon> Ajouter
        </button>
      </form>

      <table mat-table [dataSource]="fournisseurs" class="full-width">
        <ng-container matColumnDef="nom">
          <th mat-header-cell *matHeaderCellDef>Nom</th>
          <td mat-cell *matCellDef="let f"><strong>{{ f.nom }}</strong></td>
        </ng-container>
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>Email</th>
          <td mat-cell *matCellDef="let f">
            <a [href]="'mailto:' + f.email">{{ f.email }}</a>
          </td>
        </ng-container>
        <ng-container matColumnDef="telephone">
          <th mat-header-cell *matHeaderCellDef>Téléphone</th>
          <td mat-cell *matCellDef="let f">{{ f.telephone || '-' }}</td>
        </ng-container>
        <ng-container matColumnDef="categorie">
          <th mat-header-cell *matHeaderCellDef>Catégorie</th>
          <td mat-cell *matCellDef="let f">{{ f.categorie || '-' }}</td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let f">
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
    .add-form { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; }
    .full-width { width: 100%; }
  `],
})
export class FournisseursTabComponent implements OnInit {
  private fb = inject(FormBuilder);
  @Input() clientId!: number;
  fournisseurs: Fournisseur[] = [];
  columns = ['nom', 'email', 'telephone', 'categorie', 'actions'];
  form = this.fb.group({
    nom: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telephone: [''],
    categorie: [''],
  });

  constructor(private service: FournisseursService, private snack: MatSnackBar) {}

  ngOnInit() { this.load(); }
  load() { this.service.getAll(this.clientId).subscribe((d) => (this.fournisseurs = d)); }

  add() {
    this.service.create(this.clientId, this.form.value).subscribe(() => {
      this.load();
      this.form.reset();
      this.snack.open('Fournisseur ajouté', 'OK', { duration: 2000 });
    });
  }

  delete(f: Fournisseur) {
    this.service.delete(this.clientId, f.id).subscribe(() => this.load());
  }
}
