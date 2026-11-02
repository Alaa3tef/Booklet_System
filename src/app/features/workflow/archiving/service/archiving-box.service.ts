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

// ---------------------------------------------------------------------
// 1. GET /api/Boxes/by-governorate-subject
// ---------------------------------------------------------------------
export interface StorageBoxDto {
  boxId: number;
  qrCode: string;
  committeeId: number;
  committeeNumber: string;
  sequenceNo: number;
  isPacked: boolean;
  statusCode: string;
  statusName: string;
  isReadyForDelivery: boolean;
  isBlocked: boolean;
  shelfLocationId: number;
  shelfLocationCode: string;
  area: string;
  rack: string;
  shelf: string;
  bin: string;
}

export interface StorageRackDto {
  warehouseId: number;
  warehouseName: string;
  area: string;
  rack: string;
  boxes: StorageBoxDto[];
}

export interface BatchStorageDto {
  batchId: number;
  year: number;
  roundId: number;
  roundName: string;
  governorateId: number;
  governorateName: string;
  subjectId: number;
  subjectName: string;
  isReadyForDelivery: boolean;
  statusCode: string;
  statusName: string;
  racks: StorageRackDto[];
}

// ---------------------------------------------------------------------
// 2. GET /api/Boxes/storage/resolve-location/{qrCode}
// ---------------------------------------------------------------------
export interface StoredBoxLocationItemDto {
  boxId: number;
  trackingCode: string;
  sequenceNo: number;
  expectedEnvelopeCount: number;
  storedAt: string;
  committeeId: number;
  committeeNumber: string;
  schoolName: string;
  educationalAdministration: string;
  batchId: number;
  year: number;
  subjectName: string;
  governorateName: string;
  roundName: string;
}

export interface StorageLocationResolveDto {
  storageLocationId: number;
  qrCode: string;
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  rackCode: string;
  binCode: string;
  shelfCode: string;
  rack: string;
  bin: string;
  shelf: string;
  totalStored: number;
  currentStoredBoxesCount: number;
  hasCurrentlyStoredBoxes: boolean;
  storedBoxes: StoredBoxLocationItemDto[];
}

// ---------------------------------------------------------------------
// 3. GET /api/Boxes/storage/resolve-box/{trackingCode}
// ---------------------------------------------------------------------
export interface CommitteeBoxItemDto {
  boxId: number;
  trackingCode: string;
  sequenceNo: number;
  status: string;
  statusName: string;
  expectedEnvelopeCount: number;
  storageLocationId: number;
  storageLocationQrCode: string;
}

export interface BoxResolveDto {
  scannedBoxId: number;
  scannedTrackingCode: string;
  committeeId: number;
  committeeNumber: string;
  schoolName: string;
  educationalAdministration: string;
  committeeStatus: string;
  committeeStatusName: string;
  batchId: number;
  year: number;
  roundName: string;
  governorateName: string;
  subjectName: string;
  totalBoxes: number;
  boxes: CommitteeBoxItemDto[];
}

// ---------------------------------------------------------------------
// 4. POST /api/Boxes/assign-storage-location
// ---------------------------------------------------------------------
export interface AssignStorageLocationRequest {
  trackingCode: string;
  qrCode: string;
}

export interface AssignStorageLocationResult {
  boxId: number;
  trackingCode: string;
  status: string;
  statusName: string;
  storageLocationId: number;
  qrCode: string;
  warehouseId: number;
  totalStored: number;
}

// ---------------------------------------------------------------------
// 5. POST /api/Boxes/storage/confirm-committee
// ---------------------------------------------------------------------
export interface BoxPlacementItem {
  trackingCode: string;
  qrCode: string;
}

export interface ConfirmCommitteeRequest {
  placements: BoxPlacementItem[];
}

@Injectable({
  providedIn: 'root'
})
export class ArchivingBoxService {
  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.appConfig.baseURL}api`;
  }

  /**
   * GET /api/Boxes/by-governorate-subject?governorateId={int}&subjectId={int}
   */
  getBoxesByGovernorateAndSubject(
    governorateId?: number | null,
    subjectId?: number | null
  ): Observable<ApiResponse<BatchStorageDto[]>> {
    let params = new HttpParams();
    if (governorateId !== undefined && governorateId !== null && governorateId > 0) {
      params = params.set('governorateId', governorateId.toString());
    }
    if (subjectId !== undefined && subjectId !== null && subjectId > 0) {
      params = params.set('subjectId', subjectId.toString());
    }

    return this.http.get<ApiResponse<BatchStorageDto[]>>(
      `${this.baseUrl}/Boxes/by-governorate-subject`,
      { params }
    );
  }

  /**
   * GET /api/Boxes/storage/resolve-location/{qrCode}
   */
  resolveLocation(qrCode: string): Observable<ApiResponse<StorageLocationResolveDto>> {
    return this.http.get<ApiResponse<StorageLocationResolveDto>>(
      `${this.baseUrl}/Boxes/storage/resolve-location/${encodeURIComponent(qrCode.trim())}`
    );
  }

  /**
   * GET /api/Boxes/storage/resolve-box/{trackingCode}
   */
  resolveBox(trackingCode: string): Observable<ApiResponse<BoxResolveDto>> {
    return this.http.get<ApiResponse<BoxResolveDto>>(
      `${this.baseUrl}/Boxes/storage/resolve-box/${encodeURIComponent(trackingCode.trim())}`
    );
  }

  /**
   * POST /api/Boxes/assign-storage-location
   */
  assignStorageLocation(payload: AssignStorageLocationRequest): Observable<ApiResponse<AssignStorageLocationResult>> {
    return this.http.post<ApiResponse<AssignStorageLocationResult>>(
      `${this.baseUrl}/Boxes/assign-storage-location`,
      payload
    );
  }

  /**
   * POST /api/Boxes/storage/confirm-committee
   */
  confirmCommitteeStorage(payload: ConfirmCommitteeRequest): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.baseUrl}/Boxes/storage/confirm-committee`,
      payload
    );
  }
}
