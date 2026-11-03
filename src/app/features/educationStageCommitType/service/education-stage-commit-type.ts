
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../shared/services/app-config.service';

// ===============================
// Models
// ===============================

export interface EduStageCommitteeType {
  id: number;
  educationalStageId: number;
  educationalStageName: string;
  committeeTypeId: number;
  committeeTypeName: string;
  bonusType: number;
  bonus: number;
  bookletsPerEnvelope: number;
  envelopesPerBox: number;
  isActive: boolean;
  isDeleted: boolean;
  dateCreated: string;
  createdBy: string;
  lastModifiedDate: string;
  lastModifiedBy: string;
}

export interface EduStageCommitteeTypeRequest {
  educationalStageId: number;
  committeeTypeId: number;
  bonusType: number;
  bonus: number;
  bookletsPerEnvelope: number;
  envelopesPerBox: number;
}

export interface CommitteeTypeLookup {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  dateCreated?: string;
}

export interface PagedData<T> {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  meta?: string;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  succeeded: boolean;
  data: T[];
  messages?: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
  errors?: string[];
}

// ===============================
// Service
// ===============================

@Injectable({
  providedIn: 'root'
})
export class EduStageCommitteeTypesService {

  private http = inject(HttpClient);
 private readonly appConfig = inject(AppConfigService);
  private readonly apiUrl = `${this.appConfig.baseURL}api/EduStageCommitteeTypes`;
  private readonly committeeTypesUrl = `${this.appConfig.baseURL}api/CommitteeTypes`;

  // =================================
  // GET ALL
  // =================================

  getAll(
    pageNumber: number = 1,
    pageSize: number = 10,
    filters?: {
      educationalStageId?: number | null;
      committeeTypeId?: number | null;
      isActive?: boolean | null;
      searchTerm?: string;
      ascending?: boolean;
    }
  ): Observable<ApiResponse<PagedData<EduStageCommitteeType>>> {

    let params = new HttpParams()
      .set('PageNumber', pageNumber)
      .set('PageSize', pageSize)
      .set('IsPaged', true)
      .set('Ascending', filters?.ascending ?? true);

    if (filters?.educationalStageId != null) {
      params = params.set(
        'EducationalStageId',
        filters.educationalStageId
      );
    }

    if (filters?.committeeTypeId != null) {
      params = params.set(
        'CommitteeTypeId',
        filters.committeeTypeId
      );
    }

    if (filters?.isActive != null) {
      params = params.set(
        'IsActive',
        filters.isActive
      );
    }

    if (filters?.searchTerm?.trim()) {
      params = params.set(
        'SearchTerm',
        filters.searchTerm.trim()
      );
    }

    return this.http.get<ApiResponse<PagedData<EduStageCommitteeType>>>(
      this.apiUrl,
      { params }
    );
  }

  // =================================
  // GET BY ID
  // =================================

  getById(
    id: number
  ): Observable<ApiResponse<EduStageCommitteeType>> {

    return this.http.get<ApiResponse<EduStageCommitteeType>>(
      `${this.apiUrl}/${id}`
    );
  }

  // =================================
  // CREATE / UPDATE
  // Same POST endpoint
  // =================================

  save(
    request: EduStageCommitteeTypeRequest
  ): Observable<ApiResponse<EduStageCommitteeType>> {

    return this.http.post<ApiResponse<EduStageCommitteeType>>(
      this.apiUrl,
      request
    );
  }

  // =================================
  // GET COMMITTEE TYPES LOOKUP
  // =================================

  getCommitteeTypes(): Observable<ApiResponse<PagedData<CommitteeTypeLookup>>> {

    const params = new HttpParams()
      .set('PageNumber', 1)
      .set('PageSize', 100)
      .set('IsPaged', true)
      .set('Ascending', true);

    return this.http.get<ApiResponse<PagedData<CommitteeTypeLookup>>>(
      this.committeeTypesUrl,
      { params }
    );
  }
}
