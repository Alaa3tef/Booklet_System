import { TestBed } from '@angular/core/testing';

import { PrintingApproval } from './printing-approval';

describe('PrintingApproval', () => {
  let service: PrintingApproval;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PrintingApproval);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
