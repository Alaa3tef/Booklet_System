// core/services/committee.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../shared/services/app-config.service';

@Injectable({ providedIn: 'root' })
export class CommitteeService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly baseUrl = `${this.appConfig.baseURL}api/Committees`;

  uploadCommittees(
    file: File,
    governorate: string,
    subject: string,
    round: string
  ): Observable<{ success: boolean; message?: string; data?: unknown }> {

    const body = new FormData();
    body.append('file', file, file.name);
    body.append('governorate', governorate);
    body.append('subject', subject);
    body.append('round', round);

    // لا تضع Content-Type يدويًا، المتصفح بيضيفه مع الـ boundary
    return this.http.post<{ success: boolean; message?: string; data?: unknown }>(
      `${this.baseUrl}/upload`,
      body
    );
  }
}
