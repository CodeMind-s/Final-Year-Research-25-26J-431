import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CrystallizationService } from './Crystallization.service';
import { GetLogByIdDto, GetLogResponseDto } from './dtos/crystallization.dto';

@Controller('Crystallization')
export class CrystallizationController {
  constructor(
    private readonly CrystallizationService: CrystallizationService
  ) {}

  @GrpcMethod('CrystallizationService', 'GetLogById')
  async getLogById(data: GetLogByIdDto): Promise<GetLogResponseDto> {
    return this.CrystallizationService.getLogById(data);
  }
}
