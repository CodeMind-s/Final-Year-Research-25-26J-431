import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CrystallizationController } from './crystallization.controller';
import { CrystallizationService } from './crystallization.service';
import { Log, LogSchema } from './schemas/Crystallization.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Log.name, schema: LogSchema }])],
  controllers: [CrystallizationController],
  providers: [CrystallizationService],
})
export class CrystallizationModule {}
