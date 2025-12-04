import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Log } from './schemas/log.schema';
import { GetLogByIdDto, GetLogResponseDto } from './dtos/crystallization.dto';

@Injectable()
export class CrystallizationService {
  constructor(@InjectModel(Log.name) private logModel: Model<Log>) {}

  async getLogById(data: GetLogByIdDto): Promise<GetLogResponseDto> {
    try {
      const log = {
        date: { id: data.logId },
      };

      if (!log) {
        throw new NotFoundException('Log not found');
      }

      return {
        success: true,
        message: 'Log retrieved successfully',
        log: log,
      };
    } catch (error) {
      throw new BadRequestException('Failed to retrieve log');
    }
  }
}
