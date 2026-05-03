import { Module } from '@nestjs/common';
import { InferenceService } from './inference.service';
import { PreprocessingService } from './preprocessing.service';
import { PostprocessingService } from './postprocessing.service';
import { WhitenessService } from './whiteness.service';

@Module({
  providers: [InferenceService, PreprocessingService, PostprocessingService, WhitenessService],
  exports: [InferenceService, WhitenessService],
})
export class InferenceModule {}
