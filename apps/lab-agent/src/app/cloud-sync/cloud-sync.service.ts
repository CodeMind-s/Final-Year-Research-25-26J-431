import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  CreateSessionBody,
  CreateBatchBody,
  SaveDetectionBody,
  CreatedSessionResponse,
  CreatedBatchResponse,
} from './cloud-sync.types';

@Injectable()
export class CloudSyncService {
  private readonly logger = new Logger(CloudSyncService.name);
  private readonly axios: AxiosInstance;

  constructor() {
    const baseURL = process.env.BRINEX_CLOUD_URL || 'http://localhost:3400/api/v1';
    const timeout = parseInt(process.env.CLOUD_SYNC_TIMEOUT_MS || '5000', 10);
    this.axios = axios.create({ baseURL, timeout });
    this.logger.log(`CloudSync targeting ${baseURL} (timeout ${timeout}ms)`);
  }

  async createSession(token: string, body: CreateSessionBody): Promise<CreatedSessionResponse> {
    const { data } = await this.axios.post<CreatedSessionResponse>(
      '/vision/sessions',
      body,
      this.withAuth(token),
    );
    return data;
  }

  async endSession(token: string, sessionId: string): Promise<void> {
    await this.axios.patch(`/vision/sessions/${sessionId}/end`, {}, this.withAuth(token));
  }

  async createBatch(token: string, body: CreateBatchBody): Promise<CreatedBatchResponse> {
    const { data } = await this.axios.post<CreatedBatchResponse>(
      '/vision/batches',
      body,
      this.withAuth(token),
    );
    return data;
  }

  async endBatch(token: string, batchId: string): Promise<void> {
    await this.axios.patch(`/vision/batches/${batchId}/end`, {}, this.withAuth(token));
  }

  async saveDetection(token: string, body: SaveDetectionBody): Promise<{ id: string }> {
    const { data } = await this.axios.post<{ id: string }>(
      '/vision/detections',
      body,
      this.withAuth(token),
    );
    return data;
  }

  // Used by the retry queue to decide whether a failure is worth retrying.
  // 4xx (other than 408/429) means the payload is malformed or auth was rejected
  // — retrying won't help, so drop. 5xx and network errors are transient.
  isTransient(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const e = error as AxiosError;
      if (!e.response) return true; // network / timeout
      const s = e.response.status;
      if (s === 408 || s === 429) return true;
      if (s >= 500) return true;
      return false;
    }
    return true;
  }

  private withAuth(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
  }
}
