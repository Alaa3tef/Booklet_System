// service/committee-service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../shared/services/app-config.service';

export interface UploadCommitteesPayload {
  file: File;
  year: number;
  roundCode: string;
  governorateCode: string;
  educationalStageCode: string;
}

export interface HistoryQuery {
  pageNumber: number;
  pageSize: number;
  searchTerm?: string;
  ascending?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CommitteeService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  private readonly baseUrl = `${this.appConfig.baseURL}api`;

  // ---------- Lookups ----------
  getRounds() {
    return this.http.get<unknown>(`${this.baseUrl}/Rounds`);
  }

  getEducationstages() {
    return this.http.get<unknown>(`${this.baseUrl}/EducationalStages`);
  }

  getSubjects() {
    return this.http.get<unknown>(`${this.baseUrl}/Subjects`);
  }

  // ---------- POST /api/ImportExcel (multipart/form-data) ----------
  uploadCommittees(payload: UploadCommitteesPayload): Observable<unknown> {
    const body = new FormData();
    body.append('Year', String(payload.year));
    body.append('RoundCode', payload.roundCode);
    body.append('GovernorateCode', payload.governorateCode);
    body.append('EducationalStageCode', payload.educationalStageCode);
    body.append('file', payload.file, payload.file.name);

    // لا تضع Content-Type يدويًا، المتصفح بيضيفه مع الـ boundary
    return this.http.post<unknown>(`${this.baseUrl}/ImportExcel`, body);
  }

  // ---------- GET /api/ImportExcel/history ----------
  getHistory(query: HistoryQuery): Observable<unknown> {
    let params = new HttpParams()
      .set('PageNumber', query.pageNumber)
      .set('PageSize', query.pageSize);

    if (query.searchTerm?.trim()) {
      params = params.set('SearchTerm', query.searchTerm.trim());
    }
    if (query.ascending !== undefined) {
      params = params.set('Ascending', query.ascending);
    }

    return this.http.get<unknown>(`${this.baseUrl}/ProductionBatches/generated-batches`, { params });
  }
  transferToPlanning(id: number): Observable<unknown> {
    return this.http.post(
      `${this.baseUrl}/ProductionBatches/${id}/send-to-planning`,
      null,
      { responseType: 'text' }
    );
  }
}