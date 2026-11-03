
import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpParams
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../shared/services/app-config.service';

export interface CommitteeType {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  dateCreated?: string;
}

export interface CommitteeTypeRequest {
  code: string;
  name: string;
  isActive: boolean;
}

export interface PagedResult<T> {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  meta?: string;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  messages?: string[];
  succeeded: boolean;
  data: T[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
  errors?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class CommitteeTypesService {

  private http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  // عدلي الـ Base URL حسب إعدادات المشروع عندك
  private readonly apiUrl = `${this.appConfig.baseURL}api/CommitteeTypes`;

  // GET: api/CommitteeTypes
  getAll(
    pageNumber: number = 1,
    pageSize: number = 10,
    searchTerm: string = '',
    ascending: boolean = true
  ): Observable<ApiResponse<PagedResult<CommitteeType>>> {

    let params = new HttpParams()
      .set('PageNumber', pageNumber)
      .set('PageSize', pageSize)
      .set('Ascending', ascending);

    if (searchTerm.trim()) {
      params = params.set('SearchTerm', searchTerm.trim());
    }

    return this.http.get<ApiResponse<PagedResult<CommitteeType>>>(
      this.apiUrl,
      { params }
    );
  }

  // GET: api/CommitteeTypes/{id}
  getById(id: number): Observable<ApiResponse<CommitteeType>> {
    return this.http.get<ApiResponse<CommitteeType>>(
      `${this.apiUrl}/${id}`
    );
  }

  // POST: api/CommitteeTypes
  create(data: CommitteeTypeRequest): Observable<ApiResponse<CommitteeType>> {
    return this.http.post<ApiResponse<CommitteeType>>(
      this.apiUrl,
      data
    );
  }

  // PUT: api/CommitteeTypes/{id}
  update(
    id: number,
    data: CommitteeTypeRequest
  ): Observable<ApiResponse<CommitteeType>> {
    return this.http.put<ApiResponse<CommitteeType>>(
      `${this.apiUrl}/${id}`,
      data
    );
  }
}
