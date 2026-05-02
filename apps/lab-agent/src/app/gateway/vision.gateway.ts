import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { InferenceService } from '../inference/inference.service';
import { WhitenessService } from '../inference/whiteness.service';
import { ROIService, ROIConfig } from '../roi/roi.service';
import { CloudSyncService } from '../cloud-sync/cloud-sync.service';
import { CloudSyncQueueService } from '../cloud-sync/cloud-sync-queue.service';
import { JwtValidatorService } from '../cloud-sync/jwt-validator.service';
import { MetricsService } from '../metrics/metrics.service';

interface StreamSettings {
  token?: string;
  userId?: string;
  sessionId?: string;
  currentBatchId?: string;
  currentBatchNumber: number;
  saveDetections: boolean;
  confidenceThreshold: number;
  roi: ROIConfig;
  endingSession?: boolean; // guards against double end-session on disconnect
}

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

@WebSocketGateway({
  namespace: '/vision',
  cors: {
    origin: FRONTEND_ORIGIN,
    credentials: true,
  },
})
export class VisionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(VisionGateway.name);
  private clientSettings = new Map<string, StreamSettings>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly inferenceService: InferenceService,
    private readonly whitenessService: WhitenessService,
    private readonly roiService: ROIService,
    private readonly cloudSync: CloudSyncService,
    private readonly cloudSyncQueue: CloudSyncQueueService,
    private readonly jwtValidator: JwtValidatorService,
    private readonly metrics: MetricsService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    const token =
      (client.handshake.auth?.token as string | undefined) ||
      this.extractBearer(client.handshake.headers?.authorization as string | undefined);

    if (!token) {
      this.logger.warn(`Client ${client.id} connected without an auth token — disconnecting`);
      client.emit('error', { code: 'AUTH_REQUIRED', message: 'Auth token required.' });
      client.disconnect(true);
      return;
    }

    let claims;
    try {
      claims = await this.jwtValidator.verify(token);
    } catch (err: any) {
      this.logger.warn(`Client ${client.id} JWT rejected: ${err.message}`);
      client.emit('error', { code: 'AUTH_REJECTED', message: 'Token verification failed.' });
      client.disconnect(true);
      return;
    }

    this.clientSettings.set(client.id, {
      token,
      userId: claims.sub,
      saveDetections: true,
      confidenceThreshold: 0.5,
      currentBatchNumber: 0,
      roi: this.roiService.getDefaultROI(),
    });

    this.metrics.clientConnected();

    const status = this.inferenceService.getModelStatus();
    client.emit('connection_status', {
      connected: true,
      modelLoaded: status.loaded,
    });
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.metrics.clientDisconnected();
    const settings = this.clientSettings.get(client.id);
    if (settings) {
      // Best-effort close of any session that's still open. A clean stop_stream
      // sets endingSession=true so this no-ops.
      if (settings.token && settings.sessionId && !settings.endingSession) {
        try {
          if (settings.currentBatchId) {
            await this.cloudSync.endBatch(settings.token, settings.currentBatchId);
          }
          await this.cloudSync.endSession(settings.token, settings.sessionId);
        } catch (err: any) {
          this.logger.warn(
            `Failed to close session ${settings.sessionId} on disconnect: ${err.message}`,
          );
        }
      }
    }
    this.clientSettings.delete(client.id);
  }

  @SubscribeMessage('start_stream')
  async handleStartStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cameraSource?: string; roi?: ROIConfig },
  ) {
    const settings = this.clientSettings.get(client.id);
    if (!settings?.token) {
      client.emit('error', { code: 'AUTH_REQUIRED', message: 'Auth token required.' });
      return;
    }

    const roi = data?.roi && this.roiService.validateROI(data.roi)
      ? data.roi
      : this.roiService.getDefaultROI();

    try {
      const created = await this.cloudSync.createSession(settings.token, {
        cameraSource: data?.cameraSource,
        roi,
      });
      const sessionId = (created.id || created.sessionId) as string;
      if (!sessionId) {
        throw new Error('Cloud did not return a session id');
      }

      settings.sessionId = sessionId;
      settings.roi = roi;
      settings.currentBatchNumber = 0;
      settings.endingSession = false;

      this.logger.log(`Stream started for client ${client.id}, session: ${sessionId}`);
      client.emit('stream_started', { sessionId, roi });
    } catch (error: any) {
      this.logger.error(`Failed to start stream: ${error.message}`);
      client.emit('error', { code: 'START_STREAM_ERROR', message: error.message });
    }
  }

  @SubscribeMessage('stop_stream')
  async handleStopStream(@ConnectedSocket() client: Socket) {
    const settings = this.clientSettings.get(client.id);
    if (!settings) {
      client.emit('stream_stopped', { summary: null });
      return;
    }

    if (settings.token && settings.sessionId) {
      settings.endingSession = true;
      try {
        if (settings.currentBatchId) {
          await this.cloudSync.endBatch(settings.token, settings.currentBatchId);
          settings.currentBatchId = undefined;
        }
        await this.cloudSync.endSession(settings.token, settings.sessionId);
      } catch (error: any) {
        this.logger.error(`Failed to stop stream cleanly: ${error.message}`);
        client.emit('error', { code: 'STOP_STREAM_ERROR', message: error.message });
        // fall through — we still tear down local state below
      }
    }

    settings.sessionId = undefined;
    settings.currentBatchId = undefined;

    this.logger.log(`Stream stopped for client ${client.id}`);
    client.emit('stream_stopped', { summary: null });
  }

  @SubscribeMessage('start_batch')
  async handleStartBatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roi?: ROIConfig },
  ) {
    const settings = this.clientSettings.get(client.id);
    if (!settings?.token) {
      client.emit('error', { code: 'AUTH_REQUIRED', message: 'Auth token required.' });
      return;
    }
    if (!settings.sessionId) {
      client.emit('error', { code: 'NO_SESSION', message: 'No active session. Start stream first.' });
      return;
    }

    if (data?.roi && this.roiService.validateROI(data.roi)) {
      settings.roi = data.roi;
    }

    try {
      const created = await this.cloudSync.createBatch(settings.token, {
        sessionId: settings.sessionId,
        roi: settings.roi,
      });
      const batchId = (created.id || created.batchId) as string;
      if (!batchId) {
        throw new Error('Cloud did not return a batch id');
      }

      settings.currentBatchId = batchId;
      settings.currentBatchNumber += 1;

      this.logger.log(`Batch #${settings.currentBatchNumber} started for client ${client.id}`);
      client.emit('batch_started', {
        batchId,
        batchNumber: settings.currentBatchNumber,
        roi: settings.roi,
      });
    } catch (error: any) {
      this.logger.error(`Failed to start batch: ${error.message}`);
      client.emit('error', { code: 'START_BATCH_ERROR', message: error.message });
    }
  }

  @SubscribeMessage('end_batch')
  async handleEndBatch(@ConnectedSocket() client: Socket) {
    const settings = this.clientSettings.get(client.id);
    if (!settings?.token || !settings.currentBatchId) {
      client.emit('error', { code: 'NO_BATCH', message: 'No active batch to end.' });
      return;
    }

    const ended = {
      id: settings.currentBatchId,
      batchNumber: settings.currentBatchNumber,
    };

    try {
      await this.cloudSync.endBatch(settings.token, settings.currentBatchId);
    } catch (error: any) {
      this.logger.error(`Failed to end batch on cloud: ${error.message}`);
      client.emit('error', { code: 'END_BATCH_ERROR', message: error.message });
      return;
    }

    settings.currentBatchId = undefined;

    this.logger.log(`Batch ended for client ${client.id}`);
    client.emit('batch_ended', ended);
  }

  @SubscribeMessage('update_roi')
  handleUpdateROI(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roi: ROIConfig },
  ) {
    const settings = this.clientSettings.get(client.id);
    if (!settings) {
      client.emit('error', { code: 'NO_SETTINGS', message: 'Client settings not found.' });
      return;
    }

    if (!this.roiService.validateROI(data.roi)) {
      client.emit('error', { code: 'INVALID_ROI', message: 'Invalid ROI configuration.' });
      return;
    }

    settings.roi = data.roi;
    client.emit('roi_updated', { roi: settings.roi });
  }

  @SubscribeMessage('frame')
  async handleFrame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: Buffer,
  ) {
    try {
      const imageBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const settings = this.clientSettings.get(client.id);
      const roi = settings?.roi || this.roiService.getDefaultROI();

      const result = await this.inferenceService.runInference(imageBuffer);
      this.metrics.recordFrame();

      const roiStats = this.roiService.calculateROIStats(result.boundingBoxes, roi);
      const boxesWithROI = this.roiService.markBoxesWithROI(result.boundingBoxes, roi);

      const shouldSave = !!(settings?.saveDetections && settings?.currentBatchId && settings?.token);
      let boxesWithWhiteness;
      let whitenessStats = { avgWhiteness: 0, avgQualityScore: 0 };
      let roiWhitenessStats = { avgWhiteness: 0, avgQualityScore: 0 };

      if (shouldSave) {
        boxesWithWhiteness = await this.whitenessService.calculateWhiteness(
          imageBuffer,
          boxesWithROI,
          result.frameWidth,
          result.frameHeight,
        );
        whitenessStats = this.whitenessService.calculateAggregateStats(boxesWithWhiteness);
        roiWhitenessStats = this.whitenessService.calculateROIAggregateStats(boxesWithWhiteness);
      } else {
        boxesWithWhiteness = boxesWithROI.map((box) => ({
          ...box,
          whitenessPercentage: 0,
          qualityScore: 0,
        }));
      }

      if (shouldSave && settings) {
        // Fire-and-forget: the queue retries transient failures with exponential
        // backoff up to 30s and never throws back to this handler. Note v1 has
        // no idempotency keys, so retries can duplicate detections under
        // pathological cloud flapping — accepted risk per Phase 3 spec.
        this.cloudSyncQueue
          .sendOrQueue(settings.token!, {
            sessionId: settings.sessionId,
            batchId: settings.currentBatchId,
            frameWidth: result.frameWidth,
            frameHeight: result.frameHeight,
            processingTimeMs: result.processingTimeMs,
            roiPureCount: roiStats.pureCount,
            roiImpureCount: roiStats.impureCount,
            roiUnwantedCount: roiStats.unwantedCount,
            roiTotalCount: roiStats.totalCount,
            roiPurityPercentage: roiStats.purityPercentage,
            avgWhiteness: whitenessStats.avgWhiteness,
            avgQualityScore: whitenessStats.avgQualityScore,
            roiAvgWhiteness: roiWhitenessStats.avgWhiteness,
            roiAvgQualityScore: roiWhitenessStats.avgQualityScore,
            boundingBoxes: boxesWithWhiteness.map((box) => ({
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              classId: box.classId,
              className: box.className,
              confidence: box.confidence,
              whitenessPercentage: box.whitenessPercentage ?? 0,
              qualityScore: box.qualityScore ?? 0,
            })),
          })
          .catch(() => undefined);
      }

      client.emit('detection_result', {
        ...result,
        roiPureCount: roiStats.pureCount,
        roiImpureCount: roiStats.impureCount,
        roiUnwantedCount: roiStats.unwantedCount,
        roiTotalCount: roiStats.totalCount,
        roiPurityPercentage: roiStats.purityPercentage,
        avgWhiteness: whitenessStats.avgWhiteness,
        avgQualityScore: whitenessStats.avgQualityScore,
        roiAvgWhiteness: roiWhitenessStats.avgWhiteness,
        roiAvgQualityScore: roiWhitenessStats.avgQualityScore,
        boundingBoxes: boxesWithWhiteness.map((box) => ({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          classId: box.classId,
          className: box.className,
          confidence: box.confidence,
          color: box.color,
          insideROI: box.insideROI ?? false,
          whitenessPercentage: box.whitenessPercentage ?? 0,
          qualityScore: box.qualityScore ?? 0,
        })),
        roi,
        currentBatchId: settings?.currentBatchId || '',
        currentBatchNumber: settings?.currentBatchNumber || 0,
      });
    } catch (error: any) {
      this.logger.error(`Frame processing error: ${error.message}`);
      client.emit('error', { code: 'FRAME_PROCESSING_ERROR', message: error.message });
    }
  }

  @SubscribeMessage('update_settings')
  handleUpdateSettings(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { saveDetections?: boolean; confidenceThreshold?: number },
  ) {
    const settings = this.clientSettings.get(client.id);
    if (settings) {
      if (data.saveDetections !== undefined) {
        settings.saveDetections = data.saveDetections;
      }
      if (data.confidenceThreshold !== undefined) {
        settings.confidenceThreshold = data.confidenceThreshold;
      }
    }
    client.emit('settings_updated', settings);
  }

  @SubscribeMessage('get_batch_history')
  handleGetBatchHistory(@ConnectedSocket() client: Socket) {
    // Cloud-side history reads happen over the existing /api/v1 REST endpoints.
    // The agent doesn't keep batch history; emit an empty list for compatibility.
    client.emit('batch_history', { batches: [] });
  }

  private extractBearer(authHeader: string | undefined): string | undefined {
    if (!authHeader) return undefined;
    const [scheme, value] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) return undefined;
    return value;
  }
}
