import { TestBed } from '@angular/core/testing';

import { PlanningBatch } from './planning-batch';

describe('PlanningBatch', () => {
  let service: PlanningBatch;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlanningBatch);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
