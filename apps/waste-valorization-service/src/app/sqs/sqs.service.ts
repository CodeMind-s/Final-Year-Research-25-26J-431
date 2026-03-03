import { Injectable, Logger } from '@nestjs/common';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SqsService {
  private readonly logger = new Logger(SqsService.name);
  private sqsClient: SQSClient;
  private queueUrl: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY'
    );
    const accountId = this.configService.get<string>('AWS_ACCOUNT_ID');
    const environment = this.configService.get<string>('ENVIRONMENT') || 'dev';

    this.sqsClient = new SQSClient({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });

    // Prefer explicit queue url if provided, otherwise build a default FIFO queue name
    const configuredQueueUrl =
      this.configService.get<string>('AWS_SQS_QUEUE_URL');
    this.queueUrl =
      configuredQueueUrl ||
      `https://sqs.${region}.amazonaws.com/${accountId}/${environment}_waste_prediction_requests.fifo`;
  }

  async sendJobCreatedMessage(jobData: {
    jobId: string;
    userId: string;
    jobType: string;
    requestData: Record<string, unknown> | string;
  }): Promise<boolean> {
    try {
      if (!this.queueUrl) {
        this.logger.warn(
          'AWS_SQS_QUEUE_URL not configured. Skipping SQS message.'
        );
        return false;
      }

      const requestObj = jobData.requestData;

      if (!requestObj || typeof requestObj !== 'object') {
        this.logger.warn(
          `Invalid requestData for job ${
            jobData.jobId
          }. Expected object but got ${typeof requestObj}.`
        );
        return false;
      }

      // Map jobType to eventName for downstream consumers
      const jobTypeValue = jobData.jobType;
      let eventName = 'JOB/CREATED';
      if (jobTypeValue === 'WASTE_PREDICTION') {
        eventName = 'WASTE/PREDICTION';
      } else if (jobTypeValue === 'VALORIZATION_ANALYSIS') {
        eventName = 'WASTE/VALORIZATION';
      } else if (jobTypeValue === 'OPTIMIZATION') {
        eventName = 'WASTE/OPTIMIZATION';
      }

      // Ensure metadata.request_id is set to the job id
      const eventData = { ...requestObj } as Record<string, unknown>;
      if (!eventData.metadata || typeof eventData.metadata !== 'object') {
        eventData.metadata = { request_id: jobData.jobId } as Record<
          string,
          unknown
        >;
      } else {
        try {
          (eventData.metadata as Record<string, unknown>)['request_id'] =
            jobData.jobId;
        } catch {
          eventData.metadata = { request_id: jobData.jobId } as Record<
            string,
            unknown
          >;
        }
      }

      const messageBody = JSON.stringify({
        eventName,
        eventData,
        userId: jobData.userId,
        jobId: jobData.jobId,
        timestamp: new Date().toISOString(),
      });

      console.log('Prepared SQS message body:', messageBody);
      console.log('Sending message to SQS queue:', this.queueUrl);

      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: messageBody,
        MessageGroupId: 'waste-prediction-jobs', // Required for FIFO queues
        MessageDeduplicationId: jobData.jobId, // Ensure idempotency based on job ID
        MessageAttributes: {
          EventName: {
            DataType: 'String',
            StringValue: eventName,
          },
          JobId: {
            DataType: 'String',
            StringValue: jobData.jobId,
          },
          UserId: {
            DataType: 'String',
            StringValue: jobData.userId,
          },
          JobType: {
            DataType: 'String',
            StringValue: String(jobData.jobType),
          },
        },
      });

      const response = await this.sqsClient.send(command);

      this.logger.log(
        `Message sent to SQS: ${response.MessageId} for job ${jobData.jobId}`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send message to SQS: ${error.message}`,
        error.stack
      );
      // Don't throw error - we don't want SQS failures to prevent job creation
      return false;
    }
  }

  async sendJobStatusUpdateMessage(jobData: {
    jobId: string;
    status: string;
    resultData?: Record<string, unknown>;
    errorMessage?: string;
  }): Promise<boolean> {
    try {
      if (!this.queueUrl) {
        this.logger.warn(
          'AWS_SQS_QUEUE_URL not configured. Skipping SQS message.'
        );
        return false;
      }

      const messageBody = JSON.stringify({
        eventType: 'JOB_STATUS_UPDATED',
        timestamp: new Date().toISOString(),
        data: jobData,
      });

      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: messageBody,
        MessageAttributes: {
          EventType: {
            DataType: 'String',
            StringValue: 'JOB_STATUS_UPDATED',
          },
          JobId: {
            DataType: 'String',
            StringValue: jobData.jobId,
          },
          Status: {
            DataType: 'String',
            StringValue: jobData.status,
          },
        },
      });

      const response = await this.sqsClient.send(command);

      this.logger.log(
        `Status update message sent to SQS: ${response.MessageId} for job ${jobData.jobId}`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send status update to SQS: ${error.message}`,
        error.stack
      );
      return false;
    }
  }
}
