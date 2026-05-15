import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getAll() { return this.http.get<User[]>(this.api); }
  getOne(id: number) { return this.http.get<User>(`${this.api}/${id}`); }
  create(data: any) { return this.http.post<User>(this.api, data); }
  update(id: number, data: any) { return this.http.patch<User>(`${this.api}/${id}`, data); }
  delete(id: number) { return this.http.delete(`${this.api}/${id}`); }
  getAssignable() { return this.http.get<User[]>(`${this.api}/assignable`); }
  getMyTeam() { return this.http.get<{ referent: User | null; team: User[] }>(`${this.api}/my-team`); }
  setReferent(userId: number, referentId: number | null) {
    return this.http.patch<User>(`${this.api}/${userId}/referent`, { referentId });
  }
}
