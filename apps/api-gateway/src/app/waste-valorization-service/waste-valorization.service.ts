import { Injectable } from '@nestjs/common';

@Injectable()
export class WasteValorizationService {
  getData(): { message: string } {
    return { message: 'Waste Valorization service routes' };
  }
}
