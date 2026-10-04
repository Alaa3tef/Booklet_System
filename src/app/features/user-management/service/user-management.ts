import { ApiResponse, AppRolesResponse, AppUserResponse, UserRequest } from './../interfaces/useManagementResponse';
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { AppConfigService } from '../../../shared/services/app-config.service';
import { AppUser } from '../interfaces/useManagement';
import { AppRole } from '../interfaces/role';

@Injectable({
  providedIn: 'root',
})
export class UserManagement {


  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly baseUrl = `${this.appConfig.baseURL}api/Users`;

  // GET /api/users?pageNumber&pageSize&searchTerm&isActive&roleId
  getUsers(
    searchTerm?: string,
    roleId?: number,
    isActive?: boolean,
    pageNumber = 1,
    pageSize = 10
  ): Observable<AppUserResponse> {

    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    if (searchTerm?.trim()) params = params.set('searchTerm', searchTerm.trim());
    if (roleId != null)     params = params.set('roleId', roleId);
    if (isActive != null)   params = params.set('isActive', isActive);

    return this.http.get<AppUserResponse>(this.baseUrl, { params });
  }


  getUserById(id: number): Observable<ApiResponse<AppUser>> {
    return this.http.get<ApiResponse<AppUser>>(`${this.baseUrl}/${id}`);
  }

  getRoles(): Observable<AppRolesResponse> {
    return this.http.get<AppRolesResponse>(`${this.baseUrl}/roles`);
  }

  createUser(user: UserRequest): Observable<ApiResponse<AppUser>> {
    return this.http.post<ApiResponse<AppUser>>(this.baseUrl, user);
  }

  updateUser(id: number, user: UserRequest): Observable<ApiResponse<AppUser>> {
    return this.http.put<ApiResponse<AppUser>>(`${this.baseUrl}/${id}`, user);
  }

  deleteUser(id: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.baseUrl}/${id}`);
  }

  changeStatus(id: number, isActive: boolean): Observable<ApiResponse<AppUser>> {
    return this.http.patch<ApiResponse<AppUser>>(`${this.baseUrl}/${id}/status`, { isActive });
  }
}
