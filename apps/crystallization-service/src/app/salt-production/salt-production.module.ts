import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SaltProductionController } from './salt-production.controller';
import { SaltProductionService } from './salt-production.service';
import {
  ActualMonthlyProduction,
  ActualMonthlyProductionSchema,
} from './schemas/actual-monthly-production.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: ActualMonthlyProduction.name,
        schema: ActualMonthlyProductionSchema,
      },
    ]),
  ],
  controllers: [SaltProductionController],
  providers: [SaltProductionService],
  exports: [SaltProductionService],
})
export class SaltProductionModule {}
