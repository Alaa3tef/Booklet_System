export interface CommitteeRow {
  index: number;
  committeeNumber: string;
  schoolName: string;
  educationalAdministration: string;
  bookletCount: number;
  status: 'valid' | 'invalid';
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface StepItem {
  order: number;
  label: string;
  state: 'done' | 'active' | 'pending';
}
