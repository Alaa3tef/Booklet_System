import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';
import { catchError, throwError, filter, take, switchMap } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {




    const authService = inject(AuthService);




    // ==================================================
    // Get current access token
    // ==================================================

    const token = authService.getToken();


    // ==================================================
    // Add Authorization header
    // ==================================================

    const authReq = token
        ? req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        })
        : req;


    // ==================================================
    // Send request
    // ==================================================

    return next(authReq).pipe(

    );
};
