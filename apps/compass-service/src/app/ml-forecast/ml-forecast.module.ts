import { Module } from '@nestjs/common';
import { MlForecastController } from './ml-forecast.controller';
import { MlForecastService } from './ml-forecast.service';

@Module({
  controllers: [MlForecastController],
  providers: [MlForecastService],
})
export class MlForecastModule {}
