import { WasteValorizationService } from '../../waste-valorization.service';

describe('WasteValorizationService', () => {
  let service: WasteValorizationService;

  beforeEach(() => {
    service = new WasteValorizationService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  it('returns expected message from getData', () => {
    expect(service.getData()).toEqual({ message: 'Waste Valorization service routes' });
  });
});
