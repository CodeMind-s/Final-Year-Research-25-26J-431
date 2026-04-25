/**
 * Shared Kafka client configuration for all microservices.
 *
 * When KAFKA_SASL_ENABLED=true (Azure Event Hubs), adds SSL + SASL/PLAIN auth.
 * Otherwise, connects to a plain Kafka broker (local/Docker).
 */
export function getKafkaClientConfig(clientId: string): Record<string, unknown> {
  const config: Record<string, unknown> = {
    clientId,
    brokers: [process.env.KAFKA_BROKER || 'localhost:29092'],
  };

  if (process.env.KAFKA_SASL_ENABLED === 'true') {
    config.ssl = true;
    config.sasl = {
      mechanism: 'plain' as const,
      username: '$ConnectionString',
      password: process.env.KAFKA_CONNECTION_STRING || '',
    };
  }

  return config;
}
