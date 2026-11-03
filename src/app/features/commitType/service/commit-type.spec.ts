import { TestBed } from '@angular/core/testing';

import { CommitType } from './commit-type';

describe('CommitType', () => {
  let service: CommitType;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CommitType);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
