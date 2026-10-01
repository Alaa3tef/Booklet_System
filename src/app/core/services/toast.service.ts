import { Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class ToastService {

  constructor(
    private readonly messageService: MessageService
  ) {}

  // ==================================================
  // SUCCESS
  // ==================================================

  success(
    message: string,
    title = 'تمت العملية بنجاح'
  ): void {

    this.messageService.add({
      severity: 'success',
      summary: title,
      detail: message,
      life: 3500
    });

  }

  // ==================================================
  // ERROR
  // ==================================================

  error(
    message: string,
    title = 'حدث خطأ'
  ): void {

    this.messageService.add({
      severity: 'error',
      summary: title,
      detail: message,
      life: 5000
    });

  }

  // ==================================================
  // WARNING
  // ==================================================

  warning(
    message: string,
    title = 'تنبيه'
  ): void {

    this.messageService.add({
      severity: 'warn',
      summary: title,
      detail: message,
      life: 4500
    });

  }

  // ==================================================
  // INFO
  // ==================================================

  info(
    message: string,
    title = 'معلومة'
  ): void {

    this.messageService.add({
      severity: 'info',
      summary: title,
      detail: message,
      life: 4000
    });

  }

  // ==================================================
  // CLEAR
  // ==================================================

  clear(): void {

    this.messageService.clear();

  }

}