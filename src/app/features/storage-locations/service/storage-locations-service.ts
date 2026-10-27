import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { StorageLocationQuery, PagedResult, StorageLocation, CreateStorageLocationPayload, UpdateStorageLocationPayload, LookupItem } from '../model/storageLocation.model';
import { AppConfigService } from '../../../shared/services/app-config.service';

@Injectable({ providedIn: 'root' })
export class StorageLocationsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

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
    return this.http.get<PagedResult<StorageLocation>>(`${this.appConfig.baseURL}api/StorageLocations`, { params });
  }

  getById(id: number): Observable<StorageLocation> {
    return this.http.get<StorageLocation>(`${this.appConfig.baseURL}api/StorageLocations/${id}`);
  }

  create(payload: CreateStorageLocationPayload): Observable<StorageLocation> {
    return this.http.post<StorageLocation>(`${this.appConfig.baseURL}api/StorageLocations/generate`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.appConfig.baseURL}api/StorageLocations/${id}`);
  }

  // طباعة QR لكل مواقع مخزن معين (PDF)
  printQrs(warehouseId: number): Observable<Blob> {
    const params = new HttpParams().set('warehouseId', warehouseId);
    return this.http.get(`${this.appConfig.baseURL}api/StorageLocations/print-qrs`, {
      params,
      responseType: 'blob'
    });
  }

  printQr(id?: number | null): Observable<Blob> {
  const url = id != null
    ? `${this.appConfig.baseURL}api/StorageLocations/print-qrs?warehouseId=${id}`   // موقع واحد
    : `${this.appConfig.baseURL}api/StorageLocations/print-qrs`;        // الكل
  return this.http.get(url, { responseType: 'blob' });
}

// واحذف printQrs القديمة

update(id: number, body: { area: string; rack: string; shelf: string; bin: string , qrCode:string}) {
  return this.http.put(`${this.appConfig.baseURL}api/StorageLocations/${id}`, body);
}

  // TODO: adjust to the real warehouses endpoint
  getWarehouses(): Observable<LookupItem[]> {
    return this.http
      .get<any>(`${this.appConfig.baseURL}api/Warehouses`)
      .pipe(map(res => res?.data?.data ?? res?.data ?? res ?? []));
  }
}