import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Log } from './schemas/crystallization.schema';
import { GetLogByIdDto, GetLogResponseDto } from './dtos/crystallization.dto';

@Injectable()
export class CrystallizationService {
  constructor(@InjectModel(Log.name) private logModel: Model<Log>) {}

  async GetLogById(data: GetLogByIdDto): Promise<GetLogResponseDto> {
    try {
      const log = await this.logModel.findById(data.logId).exec();

      if (!log) {
        throw new NotFoundException('Log not found');
      }

      return {
        success: true,
        message: 'Log retrieved successfully',
        log: log,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve log');
    }
  }
}
