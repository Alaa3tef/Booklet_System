import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../../../../shared/services/app-config.service';

// Export dedicated report services
export {
  ProductionReportsService,

} from './production-reports.service';
export {
  WarehouseLocationReportsService,

} from './warehouse-location-reports.service';



export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T;
  statusCode: number;
  errors: string[] | null;
  count: number;
}

// ==========================================
// DTOs (الموجودة أصلاً)
// ==========================================

export interface DepartmentDto {
  code: string;
  name: string;
  includesBoxes: boolean;
}

export interface LookupItem {
  id: number;
  name: string;
}

export interface ReportLookupsDto {
  governorates: LookupItem[];
  subjects: LookupItem[];
}

export interface WorkCounts {
  batches: number;
  committees: number;
  boxes: number;
}

export interface ReportTotals {
  opening: WorkCounts;
  received: WorkCounts;
  completed: WorkCounts;
  pending: WorkCounts;
  fullyCompletedBatches: number;
}

export interface CommitteeWorkAction {
  at: string;
  employeeId: number;
  employeeName: string;
}

export interface CommitteeWork {
  opening: boolean;
  received: boolean;
  completed: boolean;
  pending: boolean;
  historyIncomplete: boolean;
  receivedAt: string | null;
  completedAt: string | null;
  receivedActions: CommitteeWorkAction[];
  completedActions: CommitteeWorkAction[];
}

export interface BoxWork extends CommitteeWork {}

export interface BoxDto {
  id: number;
  trackingCode: string;
  envelopes: number;
  work: BoxWork;
}

export interface CommitteeDto {
  id: number;
  number: string;
  schoolName: string;
  requiredBooklets: number;
  bonusBooklets: number;
  envelopes: number;
  work: CommitteeWork;
  boxes: BoxDto[];
}

export interface BatchReportDto {
  id: number;
  year: number;
  governorate: string;
  subject: string;
  round: string;
  totals: ReportTotals;
  totalCommittees: number;
  committees: CommitteeDto[];
}

export interface PagedBatches {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  data: BatchReportDto[];
}

export interface DepartmentReportDto {
  department: string;
  departmentName: string;
  includesBoxes: boolean;
  fromUtc: string;
  toUtc: string;
  timeZone: string;
  generatedAtUtc: string;
  totals: ReportTotals;
  incompleteHistoryCount: number;
  notices: string[];
  batches: PagedBatches;
}

export interface ReportFilters {
  FromDate?: string;
  ToDate?: string;
  FromTime?: string;
  ToTime?: string;
  BatchId?: number;
  GovernorateId?: number;
  SubjectId?: number;
  View?: string;
  PageNumber?: number;
  PageSize?: number;
}

// ==========================================
// NEW: Warehouse — Box locations report
// ⚠️ الأسماء دي افتراضية — عدّلها على حسب الـ Swagger عندك
// ==========================================

export type BoxLocationStatus = 'InStorage' | 'Dispatched' | 'NoLocation' | 'All';

export interface BoxLocationFilters {
  BatchId?: number;
  GovernorateId?: number;
  SubjectId?: number;
  Status?: BoxLocationStatus;
}

export interface BoxLocationSummary {
  matchingBoxes: number;
  inStorage: number;
  dispatched: number;
  noLocation: number;
}

export interface BoxLocationRow {
  trackingCode: string;
  batchId: number;
  committeeNumber: string;
  governorate: string;
  subject: string;
  round: string;
  year: number;
  warehouse: string | null;
  locationCode: string | null;     // W2.A01.R01.S02
  areaName: string | null;         // A01 منطقة
  locationDetails: string | null;  // رف S02 · خانة R01
  statusLabel: string;             // مسكنة
  locationKind: string;            // الموقع الحالي
}

export interface BoxLocationReportDto {
  summary: BoxLocationSummary;
  rows: BoxLocationRow[];
}

// ==========================================
// NEW: Management — Production tracking report
// ⚠️ افتراضي برضه
// ==========================================

export interface ProductionLookupsDto {
  years: number[];
  stages: LookupItem[];
  rounds: LookupItem[];
  governorates: LookupItem[];
  subjects: LookupItem[];
}

export interface ProductionTrackingFilters {
  Year?: number;
  StageId?: number;
  RoundId?: number;
  GovernorateId?: number;
  SubjectId?: number;
  format?: 'pdf' | 'xlsx';
}

// ==========================================
// Service
// ==========================================

@Injectable({ providedIn: 'root' })
export class WorkflowReportsService {

  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get base(): string {
    return `${this.config.baseURL}api/WorkflowReports`;
  }

  /** GET /api/WorkflowReports/departments */
  getDepartments(): Observable<ApiResponse<DepartmentDto[]>> {
    return this.http.get<ApiResponse<DepartmentDto[]>>(`${this.base}/departments`);
  }

  /** GET /api/WorkflowReports/lookups */
  getLookups(): Observable<ApiResponse<ReportLookupsDto>> {
    return this.http.get<ApiResponse<ReportLookupsDto>>(`${this.base}/lookups`);
  }

  /** GET /api/WorkflowReports/{department} */
  getReport(
    department: string,
    filters: ReportFilters = {}
  ): Observable<ApiResponse<DepartmentReportDto>> {
    return this.http.get<ApiResponse<DepartmentReportDto>>(
      `${this.base}/${department}`,
      { params: this.toParams(filters) }
    );
  }

  /** GET /api/WorkflowReports/{department}/export */
  exportReportWithFilename(
    department: string,
    filters: ReportFilters & { format?: 'pdf' | 'xlsx' }
  ): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.base}/${department}/export`, {
      params: this.toParams(filters),
      responseType: 'blob',
      observe: 'response'
    });
  }

  /** GET /api/WorkflowReports/tracking?code=... */
  trackByCode(code: string): Observable<ApiResponse<TrackingResult>> {
    const params = new HttpParams().set('code', code);
    return this.http.get<ApiResponse<TrackingResult>>(`${this.base}/tracking`, { params });
  }

  // ─── Warehouse: box locations ──────────────────────────────────────────────

  /** GET /api/WorkflowReports/box-locations */
  getBoxLocations(filters: BoxLocationFilters = {}): Observable<ApiResponse<BoxLocationReportDto>> {
    return this.http.get<ApiResponse<BoxLocationReportDto>>(
      `${this.base}/box-locations`,
      { params: this.toParams(filters) }
    );
  }

  /** GET /api/WorkflowReports/box-locations/export */
  exportBoxLocations(
    filters: BoxLocationFilters & { format: 'pdf' | 'xlsx' }
  ): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.base}/box-locations/export`, {
      params: this.toParams(filters),
      responseType: 'blob',
      observe: 'response'
    });
  }

  // ─── Management: production tracking ───────────────────────────────────────

  /** GET /api/WorkflowReports/production-tracking/lookups */
  getProductionLookups(): Observable<ApiResponse<ProductionLookupsDto>> {
    return this.http.get<ApiResponse<ProductionLookupsDto>>(
      `${this.base}/production-tracking/lookups`
    );
  }

  /** GET /api/WorkflowReports/production-tracking/export */
  exportProductionTracking(
    filters: ProductionTrackingFilters & { format: 'pdf' | 'xlsx' }
  ): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.base}/production-tracking/export`, {
      params: this.toParams(filters),
      responseType: 'blob',
      observe: 'response'
    });
  }

  // ─── helper ────────────────────────────────────────────────────────────────

  /** بيحوّل أي object لـ HttpParams ويتجاهل القيم الفاضية */
  private toParams(obj: object): HttpParams {
    let params = new HttpParams();
    Object.entries(obj).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return params;
  }
}

// ==========================================
// Tracking DTO
// ==========================================

export interface TrackingAction {
  at: string;
  employeeId: number;
  employeeName: string;
}

export interface TrackingWork {
  opening: boolean;
  received: boolean;
  completed: boolean;
  pending: boolean;
  historyIncomplete: boolean;
  receivedAt: string | null;
  completedAt: string | null;
  receivedActions: TrackingAction[];
  completedActions: TrackingAction[];
}

export interface TrackingStage {
  department: string;
  name: string;
  work: TrackingWork;
}

export interface TrackingResult {
  kind: string;
  code: string;
  batchId: number;
  committeeId: number;
  committeeNumber: string;
  schoolName: string;
  governorate: string;
  subject: string;
  round: string;
  year: number;
  currentStatus: string;
  currentStage: string;
  boxCode: string | null;
  storageLocation: string | null;
  warehouse: string | null;
  locationIsHistorical: boolean;
  isBlocked: boolean;
  asOfUtc: string;
  stages: TrackingStage[];
  notices: string[];
}