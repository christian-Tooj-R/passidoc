export interface SecteurQuestion {
  id: string;
  section?: string;
  label: string;
  type: 'radio' | 'multiselect' | 'text' | 'textarea' | 'number';
  required?: boolean;
  options?: { value: string; label: string; icon?: string }[];
  placeholder?: string;
  hint?: string;
}

export interface Secteur {
  id: number;
  code: string;
  label: string;
  icon: string;
  codeNaf?: string;
  codeNafLibelle?: string;
  questions: SecteurQuestion[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
