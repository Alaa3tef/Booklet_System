// core/models/packing.model.ts

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
  errors: string[] | null;
  count?: number;
}

export interface PageQuery {
  pageNumber: number;
  pageSize: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
}

// ---------- Batches (المواد) ----------

export interface PackingBatchFilters {
  governorateId?: number | null;
  subjectId?: number | null;
  roundId?: number | null;
  year?: number | null;
  search?: string | null;
}

export interface PackingBatch {
  batchId: number;
  label: string;
  governorateName: string;
  subjectName: string;
  year: number;
  roundName: string;
  status: string;
  pendingCommitteeCount: number;
}

// ---------- Committees (اللجان) ----------

export interface PackingCommittee {
  committeeId: number;
  committeeNumber: string;
  requiredBookletCount: number;
  bonusBookletCount: number;
  requiredEnvelopeCount: number;
  bonusEnvelopeCount: number;
  boxCount: number;
}

// ---------- Claim (الصناديق + الأظرف) ----------

export interface ClaimedBox {
  boxId: number;
  sequenceNo: number;
  qrCode: string;
  expectedEnvelopeCount: number;
  mainEnvelopes: string[];
  reserveEnvelopes: string[];
}

export interface ClaimedCommittee {
  batchId: number;
  batchLabel: string;
  committeeId: number;
  committeeNumber: string;
  status: string;
  assignedToUserId: number;
  assignedAt: string;
  boxCount: number;
  boxes: ClaimedBox[];
}

// ---------- Pack ----------

export interface PackBoxRequest {
  boxId: number;
  qrCode: string;
  envelopeSerials: string[];
}

export interface PackRequest {
  boxes: PackBoxRequest[];
}

export interface PackedBox {
  boxId: number;
  sequenceNo: number;
  qrCode: string;
  status: string;
}

export interface PackProblem {
  boxId: number;
  sequenceNo: number;
  serial: string;
  qrCode: string;
  reason: string;
}

export interface PackResult {
  committeeId: number;
  committeeNumber: string;
  status: string;
  boxes: PackedBox[];
  problems: PackProblem[];
}

export interface PackOutcome {
  success: boolean;
  message: string;
  data: PackResult | null;
}

// ---------- Release ----------

export interface ReleasedCommittee {
  committeeId: number;
  committeeNumber: string;
  requiredBookletCount: number;
  bonusBookletCount: number;
  requiredEnvelopeCount: number;
  bonusEnvelopeCount: number;
  boxCount: number;
}