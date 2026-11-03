import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../../shared/services/app-config.service';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
  errors: string[] | null;
  count?: number;
}

/** شكل الـ paged response بتاع WarehouseDelivery */
export interface PagedResult<T> {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  succeeded: boolean;
  messages?: string[];
  meta?: string;
  data: T[];
}

export interface ListQuery {
  sortBy?: string;
  pageNumber?: number;
  pageSize?: number;
  isPaged?: boolean;
  searchTerm?: string;
  ascending?: boolean;
}

// ---------------------------------------------------------------------
// Boxes: GET /api/Boxes/by-governorate-subject  (paged: data.data[])
// ---------------------------------------------------------------------
export interface StorageBoxDto {
  boxId: number; qrCode: string; committeeId: number; committeeNumber: string; sequenceNo: number;
  isPacked: boolean; statusCode: string; statusName: string; isReadyForDelivery: boolean; isBlocked: boolean;
  shelfLocationId: number; shelfLocationCode: string; area: string; rack: string; shelf: string; bin: string;
}
export interface StorageRackDto { warehouseId: number; warehouseName: string; area: string; rack: string; boxes: StorageBoxDto[]; }
export interface BatchStorageDto {
  batchId: number; year: number; roundId: number; roundName: string;
  governorateId: number; governorateName: string; subjectId: number; subjectName: string;
  isReadyForDelivery: boolean; statusCode: string; statusName: string; racks: StorageRackDto[];
}

// ---------------------------------------------------------------------
// Boxes: GET /api/Boxes/packed-items
// ---------------------------------------------------------------------
export interface PackedItemDto {
  batchId: number; label: string; governorateName: string; subjectName: string; year: number; roundName: string;
}
export interface PackedItemsQuery extends ListQuery {
  governorateId?: number; subjectId?: number; roundId?: number; year?: number; search?: string;
}

// ---------------------------------------------------------------------
// Boxes: GET /api/Boxes/batches/{batchId}/packed-committees
// ---------------------------------------------------------------------
export interface PackedCommitteeDto { committeeId: number; committeeNumber: string; boxCount: number; }

// ---------------------------------------------------------------------
// Boxes: GET /api/Boxes/storage/resolve-location/{qrCode}
// ---------------------------------------------------------------------
export interface StoredBoxLocationItemDto {
  boxId: number; trackingCode: string; sequenceNo: number; expectedEnvelopeCount: number; storedAt: string;
  committeeId: number; committeeNumber: string; schoolName: string; educationalAdministration: string;
  batchId: number; year: number; subjectName: string; governorateName: string; roundName: string;
}
export interface StorageLocationResolveDto {
  storageLocationId: number; qrCode: string; warehouseId: number; warehouseName: string; warehouseCode: string;
  rackCode: string; binCode: string; shelfCode: string; rack: string; bin: string; shelf: string;
  totalStored: number; currentStoredBoxesCount: number; hasCurrentlyStoredBoxes: boolean;
  storedBoxes: StoredBoxLocationItemDto[];
}

// ---------------------------------------------------------------------
// Boxes: GET /api/Boxes/storage/resolve-box/{trackingCode}
//        GET /api/Boxes/committees/{committeeId}/packed-boxes
// ---------------------------------------------------------------------
export interface CommitteeBoxItemDto {
  boxId: number; trackingCode: string; sequenceNo: number; status: string; statusName: string;
  expectedEnvelopeCount: number; storageLocationId: number; storageLocationQrCode: string;
}
export interface BoxResolveDto {
  scannedBoxId: number; scannedTrackingCode: string; committeeId: number; committeeNumber: string;
  schoolName: string; educationalAdministration: string; committeeStatus: string; committeeStatusName: string;
  batchId: number; year: number; roundName: string; governorateName: string; subjectName: string;
  totalBoxes: number; boxes: CommitteeBoxItemDto[];
}

// ---------------------------------------------------------------------
// Boxes: POST assign-storage-location / confirm-committee
// ---------------------------------------------------------------------
export interface AssignStorageLocationRequest { trackingCode: string; qrCode: string; }
export interface AssignStorageLocationResult {
  boxId: number; trackingCode: string; status: string; statusName: string;
  storageLocationId: number; qrCode: string; warehouseId: number; totalStored: number;
}
export interface BoxPlacementItem { trackingCode: string; qrCode: string; }
export interface ConfirmCommitteeRequest { placements: BoxPlacementItem[]; }

// ---------------------------------------------------------------------
// WarehouseDelivery
// ---------------------------------------------------------------------
/** GET /api/WarehouseDelivery/delivery-orders */
export interface DeliveryOrderDto {
  deliveryOrderId: number; year: number; roundName: string; governorateName: string; subjectName: string;
  deliveryDate: string; status: string; batchCount: number; deliveredBatchCount: number;
}
/** GET /api/WarehouseDelivery/delivery-orders/{id}/batches */
export interface DeliveryBatchDto {
  batchId: number; label: string; governorateName: string; subjectName: string;
  year: number; roundName: string; status: string; pendingCommitteeCount: number;
}
/** GET /api/WarehouseDelivery/batches/{batchId}/committees */
export interface DeliveryCommitteeBoxDto {
  boxId: number; sequenceNo: number; qrCode: string; status: string; storageLocationCode: string;
}
export interface DeliveryCommitteeDto {
  committeeId: number; committeeNumber: string; boxCount: number; boxes: DeliveryCommitteeBoxDto[];
}
/** PUT /api/WarehouseDelivery/committees/{committeeId}/deliver */
export interface DeliverProblemDto { qrCode: string; boxId: number; status: string; reason: string; }
export interface DeliverCommitteeResult {
  committeeId: number; committeeNumber: string; status: string; deliveredBoxCount: number;
  batchDelivered: boolean; deliveryOrderDelivered: boolean; problems: DeliverProblemDto[];
}

@Injectable({ providedIn: 'root' })
export class ArchivingBoxService {
  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);

  private get baseUrl(): string { return `${this.appConfig.baseURL}api`; }

  /** بنطلب كل النتايج (من غير pagination) إلا لو اتحدد غير كده */
  private toParams(q: ListQuery = {}): HttpParams {
    let p = new HttpParams().set('IsPaged', String(q.isPaged ?? false));
    if (q.sortBy) p = p.set('SortBy', q.sortBy);
    if (q.pageNumber) p = p.set('PageNumber', q.pageNumber);
    if (q.pageSize) p = p.set('PageSize', q.pageSize);
    if (q.searchTerm) p = p.set('SearchTerm', q.searchTerm);
    if (q.ascending !== undefined) p = p.set('Ascending', String(q.ascending));
    return p;
  }

  // ------------------------------------------------------------ Boxes
  /** GET /api/Boxes/packed-items (paged) */
  getPackedItems(q: PackedItemsQuery = {}): Observable<ApiResponse<PagedResult<PackedItemDto>>> {
    let p = this.toParams(q);
    if (q.governorateId) p = p.set('GovernorateId', q.governorateId);
    if (q.subjectId) p = p.set('SubjectId', q.subjectId);
    if (q.roundId) p = p.set('RoundId', q.roundId);
    if (q.year) p = p.set('Year', q.year);
    if (q.search) p = p.set('Search', q.search);
    return this.http.get<ApiResponse<PagedResult<PackedItemDto>>>(`${this.baseUrl}/Boxes/packed-items`, { params: p });
  }

  /** GET /api/Boxes/batches/{batchId}/packed-committees (paged) */
  getBatchPackedCommittees(batchId: number, q?: ListQuery): Observable<ApiResponse<PagedResult<PackedCommitteeDto>>> {
    return this.http.get<ApiResponse<PagedResult<PackedCommitteeDto>>>(
      `${this.baseUrl}/Boxes/batches/${batchId}/packed-committees`, { params: this.toParams(q) });
  }

  /** GET /api/Boxes/committees/{committeeId}/packed-boxes */
  getCommitteePackedBoxes(committeeId: number): Observable<ApiResponse<CommitteeBoxItemDto[]>> {
    return this.http.get<ApiResponse<CommitteeBoxItemDto[]>>(`${this.baseUrl}/Boxes/committees/${committeeId}/packed-boxes`);
  }

  /** الرد paged: data.data = قايمة الدفعات. بنطلب الكل (IsPaged=false) إلا لو اتحدد غير كده */
  getBoxesByGovernorateAndSubject(
    governorateId?: number | null,
    subjectId?: number | null,
    q?: ListQuery,
  ): Observable<ApiResponse<PagedResult<BatchStorageDto>>> {
    let params = this.toParams(q);
    if (governorateId && governorateId > 0) params = params.set('GovernorateId', governorateId.toString());
    if (subjectId && subjectId > 0) params = params.set('SubjectId', subjectId.toString());
    return this.http.get<ApiResponse<PagedResult<BatchStorageDto>>>(`${this.baseUrl}/Boxes/by-governorate-subject`, { params });
  }

  resolveLocation(qrCode: string): Observable<ApiResponse<StorageLocationResolveDto>> {
    return this.http.get<ApiResponse<StorageLocationResolveDto>>(
      `${this.baseUrl}/Boxes/storage/resolve-location/${encodeURIComponent(qrCode.trim())}`);
  }

  resolveBox(trackingCode: string): Observable<ApiResponse<BoxResolveDto>> {
    return this.http.get<ApiResponse<BoxResolveDto>>(
      `${this.baseUrl}/Boxes/storage/resolve-box/${encodeURIComponent(trackingCode.trim())}`);
  }

  // assignStorageLocation(payload: AssignStorageLocationRequest): Observable<ApiResponse<AssignStorageLocationResult>> {
  //   return this.http.post<ApiResponse<AssignStorageLocationResult>>(`${this.baseUrl}/Boxes/assign-storage-location`, payload);
  // }

  /** POST /api/Boxes/storage/confirm-committee */
  confirmCommitteeStorage(payload: ConfirmCommitteeRequest): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/Boxes/storage/confirm-committee`, payload);
  }

  // ------------------------------------------------------------ WarehouseDelivery
  getDeliveryOrders(q?: ListQuery): Observable<ApiResponse<PagedResult<DeliveryOrderDto>>> {
    return this.http.get<ApiResponse<PagedResult<DeliveryOrderDto>>>(
      `${this.baseUrl}/WarehouseDelivery/delivery-orders`, { params: this.toParams(q) });
  }

  getDeliveryOrderBatches(deliveryOrderId: number, q?: ListQuery): Observable<ApiResponse<PagedResult<DeliveryBatchDto>>> {
    return this.http.get<ApiResponse<PagedResult<DeliveryBatchDto>>>(
      `${this.baseUrl}/WarehouseDelivery/delivery-orders/${deliveryOrderId}/batches`, { params: this.toParams(q) });
  }

  getBatchCommittees(batchId: number, q?: ListQuery): Observable<ApiResponse<PagedResult<DeliveryCommitteeDto>>> {
    return this.http.get<ApiResponse<PagedResult<DeliveryCommitteeDto>>>(
      `${this.baseUrl}/WarehouseDelivery/batches/${batchId}/committees`, { params: this.toParams(q) });
  }

  deliverCommittee(committeeId: number, qrCodes: string[]): Observable<ApiResponse<DeliverCommitteeResult>> {
    return this.http.put<ApiResponse<DeliverCommitteeResult>>(
      `${this.baseUrl}/WarehouseDelivery/committees/${committeeId}/deliver`, { qrCodes });
  }
}
