import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommitTypeComponent } from './commit-type-component';

describe('CommitTypeComponent', () => {
  let component: CommitTypeComponent;
  let fixture: ComponentFixture<CommitTypeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommitTypeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommitTypeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
