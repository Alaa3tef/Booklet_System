// model/packing.model.ts

// =====================================================
// Generic
// =====================================================

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
  statusCode?: number;
  count?: number;
  totalCount?: number;
}

export interface PageQuery {
  pageNumber: number;
  pageSize: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
}

// =====================================================
// Batches
// =====================================================

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

// =====================================================
// Committees
// =====================================================

export interface PackingCommittee {
  committeeId: number;
  committeeNumber: string;
  requiredBookletCount: number;
  bonusBookletCount: number;
  requiredEnvelopeCount: number;
  bonusEnvelopeCount: number;
  boxCount: number;
}

/** صندوق + الأظرف اللي جواه */
export interface CommitteeBox {
  boxId: number;
  sequenceNo: number;
  qrCode: string;
  expectedEnvelopeCount: number;
  /** الأظرف الأساسية */
  requiredEnvelopes: string[];
  /** الأظرف الاحتياطية */
  bonusEnvelopes: string[];
}

/** GET /api/Committees/{id}/envelopes-with-boxes */
export interface CommitteeBoxes {
  committeeId: number;
  committeeNumber: string;
  boxes: CommitteeBox[];
}

// =====================================================
// Pack
// =====================================================

export interface PackRequest {
  boxes: {
    boxId: number;
    qrCode: string;
    envelopeSerials: string[];
  }[];
}

export interface PackProblem {
  boxId: number;
  sequenceNo: number;
  serial?: string | null;
  reason: string;
}

export interface PackedBox {
  boxId: number;
  sequenceNo: number;
  qrCode: string;
  status: string;
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
  message?: string;
  data: PackResult | null;
}

// =====================================================
// Claim / Release (غير مستخدمين حاليًا)
// =====================================================

export interface ClaimedCommittee {
  batchId: number;
  batchLabel: string;
  committeeId: number;
  committeeNumber: string;
  status: string;
  assignedToUserId?: number;
  assignedAt?: string;
  boxCount?: number;
}

export interface ReleasedCommittee {
  committeeId: number;
  committeeNumber: string;
  requiredBookletCount: number;
  bonusBookletCount: number;
  requiredEnvelopeCount: number;
  bonusEnvelopeCount: number;
  boxCount: number;
}