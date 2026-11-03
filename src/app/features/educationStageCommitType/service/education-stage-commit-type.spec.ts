import { TestBed } from '@angular/core/testing';

import { EducationStageCommitType } from './education-stage-commit-type';

describe('EducationStageCommitType', () => {
  let service: EducationStageCommitType;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EducationStageCommitType);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
