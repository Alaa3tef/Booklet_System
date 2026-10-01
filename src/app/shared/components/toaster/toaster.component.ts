import { Component } from '@angular/core';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-toast',
  imports: [ToastModule],
  templateUrl: './toaster.component.html',
  styleUrl: './toaster.component.scss',
})
export class ToastComponent {

}
