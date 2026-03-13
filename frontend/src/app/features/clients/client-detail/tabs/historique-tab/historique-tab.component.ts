import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AuditService, AuditLog } from '../../../../../core/services/audit.service';
import { LocalDatePipe } from '../../../../../core/pipes/local-date.pipe';

@Component({
  selector: 'app-historique-tab',
  standalone: true,
  imports: [CommonModule, MatIconModule, LocalDatePipe],
  template: `
    <div class="histo">
      <div class="histo-header">
        <h3>Historique des modifications</h3>
        <span class="count">{{ logs.length }} entrée(s)</span>
      </div>

      @if (loading) {
        <div class="empty"><mat-icon>hourglass_empty</mat-icon> Chargement…</div>
      } @else if (logs.length === 0) {
        <div class="empty"><mat-icon>history</mat-icon> Aucune modification enregistrée</div>
      } @else {
        <div class="timeline">
          @for (log of logs; track log.id) {
            <div class="entry" [class]="'entry-' + log.action.toLowerCase()">
              <div class="entry-icon">
                <mat-icon>{{ actionIcon(log.action) }}</mat-icon>
              </div>
              <div class="entry-body">
                <div class="entry-top">
                  <span class="action-badge" [class]="'badge-' + log.action.toLowerCase()">{{ actionLabel(log.action) }}</span>
                  <span class="resource">{{ resourceLabel(log.ressource) }}</span>
                  @if (log.ressourceId) { <span class="res-id">#{{ log.ressourceId }}</span> }
                </div>
                <div class="entry-meta">
                  <mat-icon class="meta-icon">person</mat-icon>
                  <span>{{ log.user ? log.user.firstName + ' ' + log.user.lastName : 'Système' }}</span>
                  <mat-icon class="meta-icon">schedule</mat-icon>
                  <span>{{ log.createdAt | localDate:'dd/MM/yyyy à HH:mm' }}</span>
                </div>
                @if (log.apres && hasChanges(log)) {
                  <div class="entry-changes">
                    @for (key of changedKeys(log); track key) {
                      <span class="change-pill">{{ key }}</span>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .histo { padding: 0; }
    .histo-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .histo-header h3 { font-size: 17px; font-weight: 700; color: #0f172a; margin: 0; }
    .count { font-size: 12px; color: #94a3b8; background: #f1f5f9; padding: 3px 10px; border-radius: 20px; }

    .empty { display: flex; align-items: center; gap: 10px; color: #94a3b8; font-size: 14px; padding: 40px 0; justify-content: center; }
    .empty mat-icon { font-size: 24px; width: 24px; height: 24px; }

    .timeline { display: flex; flex-direction: column; gap: 12px; }
    .entry { display: flex; gap: 12px; padding: 14px; border-radius: 12px; border: 1px solid #f1f5f9; background: white; transition: box-shadow .15s; }
    .entry:hover { box-shadow: 0 2px 8px rgba(0,0,0,.06); }

    .entry-icon { width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .entry-create .entry-icon { background: #dcfce7; color: #15803d; }
    .entry-update .entry-icon { background: #dbeafe; color: #1d4ed8; }
    .entry-delete .entry-icon { background: #fee2e2; color: #dc2626; }
    .entry-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .entry-body { flex: 1; min-width: 0; }
    .entry-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
    .action-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: .4px; }
    .badge-create { background: #dcfce7; color: #15803d; }
    .badge-update { background: #dbeafe; color: #1d4ed8; }
    .badge-delete { background: #fee2e2; color: #dc2626; }
    .resource { font-size: 13px; font-weight: 600; color: #1e293b; }
    .res-id { font-size: 11px; color: #94a3b8; }

    .entry-meta { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; }
    .meta-icon { font-size: 13px; width: 13px; height: 13px; margin-left: 6px; }
    .entry-meta span:first-of-type { margin-left: 0; }

    .entry-changes { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    .change-pill { font-size: 10.5px; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 20px; }
  `]
})
export class HistoriqueTabComponent implements OnInit {
  @Input() clientId!: number;
  logs: AuditLog[] = [];
  loading = true;

  constructor(private auditService: AuditService) {}

  ngOnInit() {
    this.auditService.getByClient(this.clientId).subscribe({
      next: logs => { this.logs = logs; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  actionIcon(action: string) {
    return action === 'CREATE' ? 'add_circle' : action === 'UPDATE' ? 'edit' : 'delete';
  }
  actionLabel(action: string) {
    return action === 'CREATE' ? 'Création' : action === 'UPDATE' ? 'Modification' : 'Suppression';
  }
  resourceLabel(r: string) {
    const map: Record<string, string> = {
      clients: 'Dossier', 'fiche-identite': 'Fiche identité',
      tasks: 'Tâche', documents: 'Document', missions: 'Mission',
      fournisseurs: 'Fournisseur', 'flux-mensuel': 'Flux mensuel',
    };
    return map[r] || r;
  }
  hasChanges(log: AuditLog) {
    return log.apres && typeof log.apres === 'object' && Object.keys(log.apres).length > 0;
  }
  changedKeys(log: AuditLog): string[] {
    if (!log.apres || !log.avant) return [];
    return Object.keys(log.apres).filter(k => !['id','createdAt','updatedAt'].includes(k)).slice(0, 5);
  }
}
