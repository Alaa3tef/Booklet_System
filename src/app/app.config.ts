import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { AppConfigService } from './shared/services/app-config.service';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),provideHttpClient(),
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
  ]
};

export function initializeApp(appConfig: AppConfigService) {
  return () => appConfig.loadConfig();
}
