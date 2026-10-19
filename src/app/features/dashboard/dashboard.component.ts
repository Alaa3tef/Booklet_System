import { AfterViewChecked, AfterViewInit, Component, ElementRef, OnDestroy, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export default class DashboardComponent implements AfterViewChecked, AfterViewInit, OnDestroy {
   @ViewChild('stageChart')
  stageChart!: ElementRef<HTMLCanvasElement>;

  @ViewChild('completionChart')
  completionChart!: ElementRef<HTMLCanvasElement>;

  @ViewChild('distributionChart')
  distributionChart!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];
  readonly currentDate = signal(new Date());

  private chartResizeObserver?: ResizeObserver;
  private chartIntersectionObserver?: IntersectionObserver;

  private chartInitTimer?: number;
  private chartInitAttempts = 0;
  private chartInitializationPending = false;

  ngAfterViewInit(): void {
    this.scheduleChartInitialization();
  }

  ngAfterViewChecked(): void {
    if (!this.chartsMatchCurrentCanvases()) {
      this.scheduleChartInitialization();
    }
  }

  private scheduleChartInitialization(): void {
    if (this.chartInitializationPending) {
      return;
    }

    this.chartInitializationPending = true;
    this.chartInitAttempts = 0;
    this.tryInitializeCharts();
  }
  get currentDayLabel(): string {
    return new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(this.currentDate());
  }

  get currentDateLabel(): string {
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(this.currentDate());
  }
  private tryInitializeCharts(): void {
    requestAnimationFrame(() => {
      if (
        !this.stageChart?.nativeElement ||
        !this.completionChart?.nativeElement ||
        !this.distributionChart?.nativeElement
      ) {
        this.retryChartInitialization();
        return;
      }

      const canvases = [
        this.stageChart.nativeElement,
        this.completionChart.nativeElement,
        this.distributionChart.nativeElement,
      ];

      const ready = canvases.every((canvas) => {
        const parent = canvas.parentElement;
        return (
          parent &&
          parent.isConnected &&
          parent.clientWidth > 0 &&
          parent.clientHeight > 0
        );
      });

      if (!ready) {
        this.retryChartInitialization();
        return;
      }

      this.destroyCharts();

      this.createCharts();
      this.chartInitializationPending = false;
    });
  }

  private retryChartInitialization(): void {
    if (this.chartInitAttempts >= 30) {
      console.warn('Charts could not be initialized because containers are not ready.');
      this.chartInitializationPending = false;
      return;
    }

    this.chartInitAttempts++;

    this.chartInitTimer = window.setTimeout(() => this.tryInitializeCharts(), 100);
  }

  private chartsMatchCurrentCanvases(): boolean {
    const canvases = [
      this.stageChart?.nativeElement,
      this.completionChart?.nativeElement,
      this.distributionChart?.nativeElement,
    ];

    return canvases.every((canvas) =>
      canvas &&
      canvas.isConnected &&
      this.charts.some((chart) => chart.canvas === canvas && chart.canvas.isConnected)
    );
  }

  private createCharts(): void {
    Chart.defaults.font.family = 'Cairo, Tajawal, sans-serif';
    Chart.defaults.color = '#0c3568';

    // ============================================
    // 1. STAGE CHART
    // ============================================

    const stageChart = new Chart(this.stageChart.nativeElement, {
      type: 'bar',

      data: {
        labels: [
          'تم إنشاء الملفات',
          'في الطباعة',
          'تم المراجعة',
          'تم التعبئة',
          'في المخزن',
        ],

        datasets: [
          {
            data: [28, 22, 18, 15, 12],

            backgroundColor: [
              '#0877df',
              '#078050',
              '#f29a2e',
              '#8968dc',
              '#28adae',
            ],

            borderRadius: 4,
            borderSkipped: false,
            maxBarThickness: 48,
          },
        ],
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        animation: {
          duration: 700,
        },

        plugins: {
          legend: {
            display: false,
          },

          tooltip: {
            rtl: true,
            textDirection: 'rtl',
          },
        },

        scales: {
          x: {
            grid: {
              display: false,
            },

            ticks: {
              color: '#0c3568',
            },
          },

          y: {
            beginAtZero: true,
            max: 40,

            ticks: {
              stepSize: 10,
              color: '#67809d',
            },

            grid: {
              color: '#e7eff8',
            },
          },
        },
      },
    });

    // ============================================
    // 2. COMPLETION CHART
    // ============================================

    const completionChart = new Chart(
      this.completionChart.nativeElement,
      {
        type: 'doughnut',

        data: {
          labels: [
            'تم إنشاء الملفات',
            'في الطباعة',
            'تم المراجعة',
            'تم التعبئة',
            'في المخزن',
          ],

          datasets: [
            {
              data: [28, 22, 18, 15, 12],

              backgroundColor: [
                '#0877df',
                '#078050',
                '#f29a2e',
                '#8968dc',
                '#28adae',
              ],

              borderWidth: 3,
              borderColor: '#ffffff',

              hoverOffset: 4,
            },
          ],
        },

        options: {
          responsive: true,
          maintainAspectRatio: false,

          cutout: '68%',

          plugins: {
            legend: {
              display: false,
            },

            tooltip: {
              rtl: true,
              textDirection: 'rtl',
            },
          },
        },
      }
    );

    // ============================================
    // 3. DISTRIBUTION CHART
    // ============================================

    const distributionChart = new Chart(
      this.distributionChart.nativeElement,
      {
        type: 'bar',

        data: {
          labels: [
            'القاهرة',
            'الجيزة',
            'الإسكندرية',
            'القليوبية',
            'المنوفية',
            'الشرقية',
            'بقية المحافظات',
          ],

          datasets: [
            {
              data: [18, 14, 12, 10, 8, 6, 27],

              backgroundColor: '#4b9de8',

              borderRadius: 4,
              borderSkipped: false,

              barThickness: 15,
            },
          ],
        },

        options: {
          responsive: true,
          maintainAspectRatio: false,

          indexAxis: 'y',

          plugins: {
            legend: {
              display: false,
            },

            tooltip: {
              rtl: true,
              textDirection: 'rtl',
            },
          },

          scales: {
            x: {
              beginAtZero: true,
              max: 30,

              ticks: {
                stepSize: 5,
                color: '#67809d',
              },

              grid: {
                color: '#e7eff8',
              },
            },

            y: {
              grid: {
                display: false,
              },

              ticks: {
                color: '#0c3568',
              },
            },
          },
        },
      }
    );

    this.charts = [
      stageChart,
      completionChart,
      distributionChart,
    ];

    // ============================================
    // RESIZE OBSERVER
    // ============================================

    this.chartResizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        this.charts.forEach((chart) => {
          if (!chart.canvas.isConnected) {
            return;
          }

          chart.resize();
        });
      });
    });

    [
      this.stageChart.nativeElement,
      this.completionChart.nativeElement,
      this.distributionChart.nativeElement,
    ].forEach((canvas) => {
      const container = canvas.parentElement;

      if (container) {
        this.chartResizeObserver?.observe(container);
      }
    });

    // ============================================
    // INTERSECTION OBSERVER
    // ============================================
    // Useful when dashboard is rendered while hidden
    // because of sidebar/layout/navigation transitions.

    this.chartIntersectionObserver =
      new IntersectionObserver(
        (entries) => {
          const visible = entries.some(
            (entry) => entry.isIntersecting
          );

          if (visible) {
            requestAnimationFrame(() => {
              this.charts.forEach((chart) => {
                chart.resize();
                chart.update('none');
              });
            });
          }
        },
        {
          threshold: 0.01,
        }
      );

    [
      this.stageChart.nativeElement,
      this.completionChart.nativeElement,
      this.distributionChart.nativeElement,
    ].forEach((canvas) => {
      this.chartIntersectionObserver?.observe(canvas);
    });

    // Final resize after layout settles
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.charts.forEach((chart) => {
          chart.resize();
          chart.update('none');
        });
      }, 100);
    });
  }

  private destroyCharts(): void {
    this.charts.forEach((chart) => {
      try {
        chart.destroy();
      } catch {
        // Ignore already destroyed charts
      }
    });

    this.charts = [];
  }

  ngOnDestroy(): void {
    console.log("hello")
    if (this.chartInitTimer) {
      window.clearTimeout(this.chartInitTimer);
    }

    this.chartResizeObserver?.disconnect();
    this.chartIntersectionObserver?.disconnect();
    this.chartInitializationPending = false;

    this.destroyCharts();
  }
}
