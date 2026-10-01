import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { GlobalLoaderComponent } from './shared/components/global-loader/global-loader.component';
import { ToastComponent } from './shared/components/toaster/toaster.component';
import { SessionExpired } from './shared/components/session-expired/session-expired';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GlobalLoaderComponent, ToastComponent, SessionExpired],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'exam-booklet-system';


}
