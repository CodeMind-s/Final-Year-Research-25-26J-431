import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';
import { Server, Socket } from 'socket.io';

interface ROIConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StreamSettings {
  userId?: string;
  sessionId?: string;
  currentBatchId?: string;
  currentBatchNumber: number;
  saveDetections: boolean;
  confidenceThreshold: number;
  roi: ROIConfig;
}

@WebSocketGateway({
  namespace: '/vision',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class VisionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(VisionGateway.name);
  private clientSettings = new Map<string, StreamSettings>();
  private visionService: any;

  @WebSocketServer()
  server: Server;

  constructor(
    @Inject('VISION_PACKAGE') private client: ClientGrpcProxy,
    private readonly jwtService: JwtService,
  ) {
    this.visionService = this.client.getService('VisionService');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    let userId: string | undefined;
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (token) {
        const payload = this.jwtService.verify(token);
        userId = payload.sub;
      }
    } catch (err) {
      this.logger.warn(`Failed to extract userId from socket auth: ${(err as Error).message}`);
    }

    this.clientSettings.set(client.id, {
      userId,
      saveDetections: true,
      confidenceThreshold: 0.5,
      currentBatchNumber: 0,
      roi: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
    });

    // Check health and send connection status
    firstValueFrom(this.visionService.GetHealth({}))
      .then((health: any) => {
        client.emit('connection_status', {
          connected: true,
          modelLoaded: health.modelLoaded,
        });
      })
      .catch(() => {
        client.emit('connection_status', {
          connected: true,
          modelLoaded: false,
        });
      });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    const settings = this.clientSettings.get(client.id);
    if (settings?.sessionId) {
      if (settings.currentBatchId) {
        firstValueFrom(
          this.visionService.EndBatch({ batchId: settings.currentBatchId }),
        ).catch((err: any) => {
          this.logger.error(`Failed to end batch on disconnect: ${err.message}`);
        });
      }
      firstValueFrom(
        this.visionService.EndSession({ sessionId: settings.sessionId }),
      ).catch((err: any) => {
        this.logger.error(`Failed to end session on disconnect: ${err.message}`);
      });
    }
    this.clientSettings.delete(client.id);
  }

  @SubscribeMessage('start_stream')
  async handleStartStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId?: string; cameraSource?: string; roi?: ROIConfig },
  ) {
    try {
      const roi = data.roi || { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };
      const settings = this.clientSettings.get(client.id);

      let sessionId = data.sessionId;

      if (!sessionId) {
        const session = await firstValueFrom(
          this.visionService.CreateSession({
            cameraSource: data.cameraSource || '',
            roi,
            user_id: settings?.userId || '',
          }),
        ) as any;
        sessionId = session.id;
      }

      if (settings) {
        settings.sessionId = sessionId;
        settings.roi = roi;
        settings.currentBatchNumber = 0;
      }

      this.logger.log(`Stream started for client ${client.id}, session: ${sessionId}`);
      client.emit('stream_started', { sessionId, roi });
    } catch (error: any) {
      this.logger.error(`Failed to start stream: ${error.message}`);
      client.emit('error', { code: 'START_STREAM_ERROR', message: error.message });
    }
  }

  @SubscribeMessage('stop_stream')
  async handleStopStream(@ConnectedSocket() client: Socket) {
    try {
      const settings = this.clientSettings.get(client.id);
      let summary: any = null;

      if (settings?.currentBatchId) {
        await firstValueFrom(
          this.visionService.EndBatch({ batchId: settings.currentBatchId }),
        );
        settings.currentBatchId = undefined;
      }

      if (settings?.sessionId) {
        summary = await firstValueFrom(
          this.visionService.EndSession({ sessionId: settings.sessionId }),
        );
        settings.sessionId = undefined;
      }

      this.logger.log(`Stream stopped for client ${client.id}`);
      client.emit('stream_stopped', { summary });
    } catch (error: any) {
      this.logger.error(`Failed to stop stream: ${error.message}`);
      client.emit('error', { code: 'STOP_STREAM_ERROR', message: error.message });
    }
  }

  @SubscribeMessage('start_batch')
  async handleStartBatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roi?: ROIConfig },
  ) {
    try {
      const settings = this.clientSettings.get(client.id);

      if (!settings?.sessionId) {
        client.emit('error', { code: 'NO_SESSION', message: 'No active session. Start stream first.' });
        return;
      }

      if (settings.currentBatchId) {
        const endedBatch = await firstValueFrom(
          this.visionService.EndBatch({ batchId: settings.currentBatchId }),
        );
        client.emit('batch_ended', endedBatch);
      }

      if (data.roi) {
        settings.roi = data.roi;
      }

      const batch = await firstValueFrom(
        this.visionService.CreateBatch({
          sessionId: settings.sessionId,
          roi: settings.roi,
          user_id: settings.userId || '',
        }),
      ) as any;

      settings.currentBatchId = batch.id;
      settings.currentBatchNumber = batch.batchNumber;

      this.logger.log(`Batch #${batch.batchNumber} started for client ${client.id}`);
      client.emit('batch_started', {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        roi: settings.roi,
      });
    } catch (error: any) {
      this.logger.error(`Failed to start batch: ${error.message}`);
      client.emit('error', { code: 'START_BATCH_ERROR', message: error.message });
    }
  }

  @SubscribeMessage('end_batch')
  async handleEndBatch(@ConnectedSocket() client: Socket) {
    try {
      const settings = this.clientSettings.get(client.id);

      if (!settings?.currentBatchId) {
        client.emit('error', { code: 'NO_BATCH', message: 'No active batch to end.' });
        return;
      }

      const batch = await firstValueFrom(
        this.visionService.EndBatch({ batchId: settings.currentBatchId }),
      );

      this.logger.log(`Batch ended for client ${client.id}`);
      settings.currentBatchId = undefined;
      client.emit('batch_ended', batch);
    } catch (error: any) {
      this.logger.error(`Failed to end batch: ${error.message}`);
      client.emit('error', { code: 'END_BATCH_ERROR', message: error.message });
    }
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

    const { roi } = data;
    if (
      roi.x < 0 || roi.x > 1 ||
      roi.y < 0 || roi.y > 1 ||
      roi.width <= 0 || roi.width > 1 ||
      roi.height <= 0 || roi.height > 1 ||
      roi.x + roi.width > 1 ||
      roi.y + roi.height > 1
    ) {
      client.emit('error', { code: 'INVALID_ROI', message: 'Invalid ROI configuration.' });
      return;
    }

    settings.roi = roi;
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

      const result = await firstValueFrom(
        this.visionService.ProcessFrame({
          imageData: imageBuffer,
          sessionId: settings?.sessionId || '',
          batchId: settings?.currentBatchId || '',
          roi: settings?.roi || { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
          saveDetection: settings?.saveDetections && !!settings?.currentBatchId,
          user_id: settings?.userId || '',
        }),
      ) as any;

      if (result.batchStats) {
        client.emit('batch_stats_updated', result.batchStats);
      }

      client.emit('detection_result', {
        ...result,
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
  async handleGetBatchHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { limit?: number },
  ) {
    try {
      const settings = this.clientSettings.get(client.id);

      if (!settings?.sessionId) {
        client.emit('error', { code: 'NO_SESSION', message: 'No active session.' });
        return;
      }

      const result = await firstValueFrom(
        this.visionService.GetSessionBatches({
          sessionId: settings.sessionId,
          user_id: settings.userId || '',
        }),
      ) as any;

      const batches = result.batches || [];
      const limited = data.limit ? batches.slice(0, data.limit) : batches;

      client.emit('batch_history', { batches: limited });
    } catch (error: any) {
      this.logger.error(`Failed to get batch history: ${error.message}`);
      client.emit('error', { code: 'BATCH_HISTORY_ERROR', message: error.message });
    }
  }
}
