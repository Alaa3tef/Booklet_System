import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { Breadcrumb, HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent implements OnInit {
  sidebarOpen = false;

  userName = 'أحمد محمد';

  userRole = 'Printing';

  breadcrumbs: Breadcrumb[] = [];

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.updateBreadcrumbs();

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.updateBreadcrumbs());
  }

  private updateBreadcrumbs(): void {
    let route = this.activatedRoute;

    while (route.firstChild) {
      route = route.firstChild;
    }

    const currentLabel = route.snapshot.data['breadcrumb'] as string | undefined;

    this.breadcrumbs = currentLabel
      ? [{ label: 'الرئيسية', route: '/dashboard' }, { label: currentLabel }]
      : [{ label: 'الرئيسية' }];
  }


  /**
   * فتح / غلق الـ Sidebar
   */
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }


  /**
   * غلق الـ Sidebar
   */
  closeSidebar(): void {
    this.sidebarOpen = false;
  }
}
