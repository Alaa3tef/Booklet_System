import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../shared/services/app-config.service';
import {
  ApiResponse, Warehouse, WarehouseRequest, WarehousesResponse
} from '../interfaces/warehouse';

@Injectable({ providedIn: 'root' })
export class WarehouseService {

  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  private readonly baseUrl = `${this.appConfig.baseURL}api/Warehouses`;

  // NOTE: the query parameter names are assumed (same convention as /api/Users).
  // Check them in Swagger (GET /api/Warehouses) and adjust if they differ.
  getAll(searchTerm = '', pageNumber = 1, pageSize = 10): Observable<WarehousesResponse> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    if (searchTerm.trim()) params = params.set('searchTerm', searchTerm.trim());

    return this.http.get<WarehousesResponse>(this.baseUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<Warehouse>> {
    return this.http.get<ApiResponse<Warehouse>>(`${this.baseUrl}/${id}`);
  }

  create(body: WarehouseRequest): Observable<ApiResponse<Warehouse>> {
    return this.http.post<ApiResponse<Warehouse>>(this.baseUrl, body);
  }

  update(id: number, body: WarehouseRequest): Observable<ApiResponse<Warehouse>> {
    return this.http.put<ApiResponse<Warehouse>>(`${this.baseUrl}/${id}`, body);
  }

  delete(id: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.baseUrl}/${id}`);
  }
}
