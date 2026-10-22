import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../shared/services/app-config.service';
import { UserSession, UserSessionsResponse } from '../model/user-session.model';

@Injectable({ providedIn: 'root' })
export class UserSessionsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly baseUrl = `${this.appConfig.baseURL}api/UserSessions`;


  /** GET /api/UserSessions — all active sessions */
  getAll(pageNumber = 1, pageSize = 10): Observable<UserSessionsResponse> {
    const params = new HttpParams()
      .set('PageNumber', pageNumber)
      .set('PageSize', pageSize);

    return this.http.get<UserSessionsResponse>(this.baseUrl, { params });
  }

  /** GET /api/UserSessions/{userId} — single user session */
  getByUserId(userId: number): Observable<UserSession> {
    return this.http.get<UserSession>(`${this.baseUrl}/${userId}`);
  }

  /** DELETE /api/UserSessions/{userId} — force-logout a user */
  revokeSession(userId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${userId}`);
  }
}
