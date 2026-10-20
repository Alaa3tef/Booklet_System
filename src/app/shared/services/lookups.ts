import { inject, Injectable } from '@angular/core';
import { AppConfigService } from './app-config.service';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class Lookups {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  private readonly baseUrl = `${this.appConfig.baseURL}api`;

  getLookupGovernorateData() {
    return this.http.get(`${this.baseUrl}/Governorates`);
  }

   getLookupSubjectData() {
    return this.http.get(`${this.baseUrl}/Subjects`);
  }

}
