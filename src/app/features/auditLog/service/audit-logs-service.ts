import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { AppConfigService } from '../../../shared/services/app-config.service';
import { AuditLogFilter, PagedResult, AuditLog, DeliveryOrderLookup, BatchLookup, ActorLookup, CommitteeLookup } from '../model/auditLog.model';


@Injectable({ providedIn: 'root' })
export class AuditLogsService {
  appConfig = inject(AppConfigService);

  private readonly baseUrl = `${this.appConfig.baseURL}api/AuditLogs`;

  constructor(private http: HttpClient) {}

  /** يحوّل أي شكل للـ data إلى Array */
  private toArray<T>(data: any): T[] {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      for (const key of ['items', 'data', 'results', 'records', 'list', '$values']) {
        if (Array.isArray(data[key])) return data[key];
      }
    }
    return [];
  }

  private lookup<T>(url: string, params?: HttpParams): Observable<T[]> {
    return this.http.get<any>(url, { params }).pipe(
      map(res => this.toArray<T>(res?.data ?? res)),
      catchError(err => {
        console.error('Lookup failed:', url, err);
        return of([] as T[]);
      })
    );
  }

  search(filter: AuditLogFilter): Observable<PagedResult<AuditLog>> {
    let params = new HttpParams();
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<any>(`${this.baseUrl}/search`, { params }).pipe(
      map(res => {
        const payload = res?.data;
        const items = this.toArray<AuditLog>(payload);

        // لو الـ pagination جوه data نفسها ندمجها مع الـ root
        const meta = Array.isArray(payload) ? res : { ...res, ...payload };

        const pageSize = meta.pageSize ?? filter.pageSize;
        const pageNumber = meta.currentPage ?? meta.pageNumber ?? filter.pageNumber;
        const totalCount = meta.totalCount ?? meta.totalRecords ?? meta.total ?? items.length;
        const totalPages = meta.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize));

        return {
          items,
          pageNumber,
          pageSize,
          totalCount,
          totalPages,
          hasNextPage: meta.hasNextPage ?? pageNumber < totalPages,
          hasPreviousPage: meta.hasPreviousPage ?? pageNumber > 1
        } as PagedResult<AuditLog>;
      })
    );
  }

  getDeliveryOrders() {
    return this.lookup<DeliveryOrderLookup>(`${this.baseUrl}/lookups/delivery-orders`);
  }

  getBatches() {
    return this.lookup<BatchLookup>(`${this.baseUrl}/lookups/batches`);
  }

  getActors() {
    return this.lookup<ActorLookup>(`${this.baseUrl}/lookups/actors`);
  }

  getActions() {
    return this.lookup<string>(`${this.baseUrl}/lookups/actions`);
  }

  getCommittees(batchId: number) {
    const params = new HttpParams().set('batchId', batchId);
    return this.lookup<CommitteeLookup>(`${this.baseUrl}/lookups/committees`, params);
  }
}