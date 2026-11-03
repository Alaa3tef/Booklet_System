import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EducationStageCommitteeTypeComponent } from './education-stage-committee-type-component';

describe('EducationStageCommitteeTypeComponent', () => {
  let component: EducationStageCommitteeTypeComponent;
  let fixture: ComponentFixture<EducationStageCommitteeTypeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EducationStageCommitteeTypeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EducationStageCommitteeTypeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
