import { ChannelCredentials } from '@grpc/grpc-js';

/**
 * Returns gRPC channel credentials based on the environment.
 * In Azure Container Apps, internal services use TLS (port 443),
 * so we need SSL credentials. Locally, we use insecure credentials.
 */
export function getGrpcCredentials(): ChannelCredentials | undefined {
  if (process.env.GRPC_SSL === 'true') {
    return ChannelCredentials.createSsl();
  }
  return undefined;
}
