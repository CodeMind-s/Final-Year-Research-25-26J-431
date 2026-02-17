import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { InferenceService } from '../inference/inference.service';

@Controller()
export class HealthController {
  constructor(private readonly inferenceService: InferenceService) {}

  @GrpcMethod('VisionService', 'GetHealth')
  getHealth() {
    const status = this.inferenceService.getModelStatus();
    return {
      modelLoaded: status.loaded,
      modelPath: status.path,
      status: status.loaded ? 'healthy' : 'unhealthy',
    };
  }
}
