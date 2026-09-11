import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TabSaveService {
  private _saveFn   = signal<(() => void) | null>(null);
  private _enterFn  = signal<(() => void) | null>(null);
  private _cancelFn = signal<(() => void) | null>(null);
  private _editing  = signal<boolean>(false);
  private _toggle   = signal<boolean>(false);

  readonly hasSave   = computed(() => this._saveFn() !== null);
  readonly hasToggle = computed(() => this._toggle());
  readonly isEditing = computed(() => this._editing());

  /** Tab always editable — shows Enregistrer permanently */
  register(saveFn: () => void): void {
    this._saveFn.set(saveFn);
    this._enterFn.set(null);
    this._cancelFn.set(null);
    this._toggle.set(false);
    this._editing.set(false);
  }

  /** Tab with view/edit toggle — Modifier → Enregistrer + Annuler */
  registerEditMode(enterFn: () => void, saveFn: () => void, cancelFn: () => void): void {
    this._enterFn.set(enterFn);
    this._saveFn.set(saveFn);
    this._cancelFn.set(cancelFn);
    this._toggle.set(true);
    this._editing.set(false);
  }

  setEditing(v: boolean): void { this._editing.set(v); }

  clear(): void {
    this._saveFn.set(null);
    this._enterFn.set(null);
    this._cancelFn.set(null);
    this._toggle.set(false);
    this._editing.set(false);
  }

  trigger():   void { this._saveFn()?.(); }
  enterEdit(): void { this._enterFn()?.(); }
  cancel():    void { this._cancelFn()?.(); }
}
