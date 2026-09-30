import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { AppConfigService } from './shared/services/app-config.service';
import { HTTP_INTERCEPTORS,withInterceptorsFromDi } from '@angular/common/http';
import { LoadingInterceptor } from './core/interceptors/loading.interceptor';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptor/auth-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),provideHttpClient(
  withInterceptorsFromDi()
),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor]),
),
    provideAnimationsAsync(),
    providePrimeNG({
      ripple: true,
      inputStyle: 'outlined',
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: false, // this system uses a fixed light theme
          cssLayer: {
            name: 'primeng',
            order: 'tailwind-base, primeng, tailwind-utilities'
          }
        }
      }
    }),
     AppConfigService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [AppConfigService],
      multi: true
    },
     {
      provide: HTTP_INTERCEPTORS,
      useClass: LoadingInterceptor,
      multi: true
    }
  ]
};

export function initializeApp(appConfig: AppConfigService) {
  return () => appConfig.loadConfig();
}
