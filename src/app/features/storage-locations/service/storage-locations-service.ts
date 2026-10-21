import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StorageLocationQuery, PagedResult, StorageLocation, CreateStorageLocationPayload, UpdateStorageLocationPayload, LookupItem } from '../model/storageLocation.model';



@Injectable({ providedIn: 'root' })
export class StorageLocationsService {
  private readonly http = inject(HttpClient);

  // TODO: replace with environment.apiUrl
  private readonly baseUrl = '/api';
  private readonly url = `${this.baseUrl}/StorageLocations`;

  getAll(query: StorageLocationQuery): Observable<PagedResult<StorageLocation>> {
    let params = new HttpParams()
      .set('PageNumber', query.pageNumber)
      .set('PageSize', query.pageSize);

    if (query.warehouseId) {
      params = params.set('WarehouseId', query.warehouseId);
    }
    if (query.searchTerm?.trim()) {
      params = params.set('SearchTerm', query.searchTerm.trim());
    }
    if (query.ascending !== undefined) {
      params = params.set('Ascending', query.ascending);
    }

    return this.http.get<PagedResult<StorageLocation>>(this.url, { params });
  }

  getById(id: number): Observable<StorageLocation> {
    return this.http.get<StorageLocation>(`${this.url}/${id}`);
  }

  create(payload: CreateStorageLocationPayload): Observable<StorageLocation> {
    return this.http.post<StorageLocation>(this.url, payload);
  }

  update(id: number, payload: UpdateStorageLocationPayload): Observable<void> {
    return this.http.put<void>(`${this.url}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  // TODO: adjust to the real warehouses endpoint
  getWarehouses(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.baseUrl}/Warehouses`);
  }
}