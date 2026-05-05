# Microservices System Setup Plan

> Complete setup guide for building **api-gateway**, **user**, **auth**, **reservation**, **listing**, and **notification** services — based on the architecture patterns used in this project.

---

## 1. Architecture Overview

```mermaid
graph TD
    Client["Client (Mobile / Web)"]
    
    subgraph Docker["Docker Compose Network"]
        GW["API Gateway :3400<br/>REST + Swagger"]
        
        subgraph gRPC_Services["gRPC Microservices"]
            AUTH["Auth Service :50000"]
            USER["User Service :50053"]
            RES["Reservation Service :50060"]
            LIST["Listing Service :50061"]
        end

        subgraph Kafka_Services["Kafka Consumers"]
            NOTIF["Notification Service"]
        end

        subgraph Infrastructure["Infrastructure"]
            ZK["Zookeeper :2181"]
            KF["Kafka :9092"]
            MONGO[(MongoDB Atlas)]
        end
    end
    
    Client -->|HTTP/REST| GW
    GW -->|gRPC| AUTH
    GW -->|gRPC| USER
    GW -->|gRPC| RES
    GW -->|gRPC| LIST
    GW -->|Kafka produce| KF
    AUTH -->|Kafka produce| KF
    RES -->|Kafka produce| KF
    KF -->|Kafka consume| NOTIF
    ZK --- KF
    AUTH --> MONGO
    USER --> MONGO
    RES --> MONGO
    LIST --> MONGO
```

### Communication Patterns

| Pattern | Technology | Use Case |
|---------|-----------|----------|
| **Synchronous** | gRPC (protobuf) | Gateway ↔ Auth, User, Reservation, Listing |
| **Asynchronous** | Kafka (via Zookeeper) | Event-driven notifications (email, SMS, push) |
| **External API** | REST / HTTP | Client ↔ API Gateway |

---

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 20 (Alpine) |
| Framework | NestJS | 11.x |
| Monorepo | Nx | 21.x |
| gRPC | `@grpc/grpc-js` + `@grpc/proto-loader` | 1.13+ / 0.8+ |
| Kafka | `kafkajs` + NestJS `@nestjs/microservices` | 2.2+ |
| Database | MongoDB (Mongoose) | 8.x |
| Auth | JWT (`@nestjs/jwt`) + Passport | 11.x |
| API Docs | Swagger (`@nestjs/swagger`) | 11.x |
| Containerization | Docker + Docker Compose | latest |
| Build | Webpack (via Nx) | 5.x |

---

## 3. Project Structure

```
project-root/
├── apps/
│   ├── api-gateway/          # REST gateway (HTTP → gRPC bridge)
│   │   ├── src/
│   │   │   ├── main.ts       # NestFactory.create (HTTP server)
│   │   │   ├── app/
│   │   │   │   ├── app.module.ts
│   │   │   │   ├── auth/     # Auth routes → gRPC calls
│   │   │   │   ├── user/     # User routes → gRPC calls
│   │   │   │   ├── reservation/  # Reservation routes → gRPC calls
│   │   │   │   └── listing/      # Listing routes → gRPC calls
│   │   │   └── filters/
│   │   │       └── grpc-exception.filter.ts
│   │   ├── package.json
│   │   └── webpack.config.js
│   │
│   ├── auth-service/         # gRPC microservice
│   │   ├── src/
│   │   │   ├── main.ts       # NestFactory.createMicroservice (Transport.GRPC)
│   │   │   └── app/
│   │   │       ├── app.module.ts
│   │   │       └── auth/
│   │   │           ├── auth.controller.ts   # @GrpcMethod handlers
│   │   │           ├── auth.service.ts
│   │   │           ├── schemas/             # Mongoose schemas
│   │   │           └── dtos/
│   │   └── package.json
│   │
│   ├── user-service/         # gRPC microservice
│   ├── reservation-service/  # gRPC microservice (NEW)
│   ├── listing-service/      # gRPC microservice (NEW)
│   └── notification-service/ # Kafka consumer (NEW)
│
├── proto/                    # Shared protobuf definitions
│   ├── auth.proto
│   ├── user.proto
│   ├── reservation.proto     # NEW
│   └── listing.proto         # NEW
│
├── docker-compose.yml
├── Dockerfile                # Multi-stage (shared across services)
├── nx.json
├── package.json
└── tsconfig.base.json
```

---

## 4. Infrastructure Setup

### 4.1 Zookeeper (Kafka Coordinator)

```yaml
# docker-compose.yml
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    container_name: zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "22181:2181"
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "nc", "-z", "localhost", "2181"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### 4.2 Kafka (Message Broker)

```yaml
  kafka:
    image: confluentinc/cp-kafka:7.5.0
    container_name: kafka
    depends_on:
      zookeeper:
        condition: service_healthy
    ports:
      - "29092:29092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:29092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "kafka-broker-api-versions", "--bootstrap-server", "localhost:9092"]
      interval: 10s
      timeout: 10s
      retries: 5
      start_period: 40s
```

> **Key Points:**
> - `PLAINTEXT://kafka:9092` — used by services inside Docker network
> - `PLAINTEXT_HOST://localhost:29092` — used for local development outside Docker
> - Zookeeper must be healthy before Kafka starts

---

## 5. Service-by-Service Setup

### 5.1 Auth Service (gRPC)

**Port:** `50000` | **Transport:** gRPC | **Proto package:** `auth`

#### Proto Definition (`proto/auth.proto`)
```protobuf
syntax = "proto3";
package auth;

service AuthService {
  rpc SignUp(SignUpRequest) returns (SignUpResponse);
  rpc SignIn(SignInRequest) returns (SignInResponse);
  rpc VerifyOtp(VerifyOtpRequest) returns (VerifyOtpResponse);
  rpc Login(LoginRequest) returns (LoginResponse);
}

message SignUpRequest { string email = 1; string phone = 2; string role = 3; }
message SignUpResponse { bool success = 1; string message = 2; }
message SignInRequest { string email = 1; string phone = 2; }
message SignInResponse { bool success = 1; string message = 2; }
message VerifyOtpRequest { string email = 1; string phone = 2; string code = 3; }
message VerifyOtpResponse { bool success = 1; string accessToken = 2; }
message LoginRequest { string email = 1; string password = 2; }
message LoginResponse { string token = 1; }
```

#### Entry Point (`main.ts`)
```typescript
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'auth',
      protoPath: join(__dirname, 'proto/auth.proto'),
      url: process.env.GRPC_URL || '0.0.0.0:50000',
    },
  });
  await app.listen();
}
bootstrap();
```

#### gRPC Controller
```typescript
import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod('AuthService', 'SignUp')
  async signUp(data: SignUpDto) {
    try {
      return await this.authService.signUp(data);
    } catch (error: any) {
      throw new RpcException({ code: 2, message: error.message });
    }
  }

  @GrpcMethod('AuthService', 'Login')
  async login(data: LoginDto) {
    try {
      return await this.authService.login(data.email, data.password);
    } catch (error: any) {
      throw new RpcException({ code: 16, message: error.message });
    }
  }
}
```

#### Module with Kafka Producer
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: { expiresIn: '7d' },
    }),
    // Kafka producer for sending events to notification-service
    ClientsModule.register([{
      name: 'NOTIFICATION_SERVICE',
      transport: Transport.KAFKA,
      options: {
        client: { clientId: 'auth-service', brokers: [process.env.KAFKA_BROKER || 'localhost:29092'] },
        consumer: { groupId: 'auth-notification-consumer-group' },
      },
    }]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
```

---

### 5.2 User Service (gRPC)

**Port:** `50053` | **Transport:** gRPC | **Proto package:** `user`

#### Proto Definition (`proto/user.proto`)
```protobuf
syntax = "proto3";
package user;

service UserService {
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc GetAllUsers(ListUsersRequest) returns (ListUsersResponse);
  rpc UpdateUser(UpdateUserRequest) returns (UpdateUserResponse);
  rpc DeleteUser(DeleteUserRequest) returns (DeleteUserResponse);
}
// ... message definitions
```

#### Entry Point (`main.ts`)
```typescript
async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'user',
      protoPath: join(__dirname, 'proto/user.proto'),
      url: process.env.GRPC_URL || '0.0.0.0:50053',
    },
  });
  await app.listen();
}
```

---

### 5.3 Reservation Service (gRPC) — NEW

**Port:** `50060` | **Transport:** gRPC | **Proto package:** `reservation`

#### Proto Definition (`proto/reservation.proto`)
```protobuf
syntax = "proto3";
package reservation;
import "google/protobuf/timestamp.proto";

service ReservationService {
  rpc CreateReservation(CreateReservationRequest) returns (ReservationResponse);
  rpc GetReservation(GetReservationRequest) returns (ReservationResponse);
  rpc GetUserReservations(GetUserReservationsRequest) returns (ReservationListResponse);
  rpc UpdateReservationStatus(UpdateStatusRequest) returns (ReservationResponse);
  rpc CancelReservation(CancelReservationRequest) returns (ReservationResponse);
  rpc GetListingReservations(GetListingReservationsRequest) returns (ReservationListResponse);
}

message CreateReservationRequest {
  string user_id = 1;
  string listing_id = 2;
  google.protobuf.Timestamp check_in = 3;
  google.protobuf.Timestamp check_out = 4;
  int32 guests = 5;
}

message ReservationResponse {
  bool success = 1;
  string message = 2;
  Reservation reservation = 3;
}

message Reservation {
  string id = 1;
  string user_id = 2;
  string listing_id = 3;
  string status = 4;  // 'pending' | 'confirmed' | 'cancelled' | 'completed'
  google.protobuf.Timestamp check_in = 5;
  google.protobuf.Timestamp check_out = 6;
  int32 guests = 7;
  double total_price = 8;
}
```

#### Entry Point (`main.ts`)
```typescript
async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'reservation',
      protoPath: join(__dirname, 'proto/reservation.proto'),
      url: process.env.GRPC_URL || '0.0.0.0:50060',
    },
  });
  await app.listen();
}
```

#### Module (with Kafka producer for notifications)
```typescript
@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI),
    MongooseModule.forFeature([{ name: Reservation.name, schema: ReservationSchema }]),
    ClientsModule.register([{
      name: 'NOTIFICATION_SERVICE',
      transport: Transport.KAFKA,
      options: {
        client: { clientId: 'reservation-service', brokers: [process.env.KAFKA_BROKER || 'localhost:29092'] },
        consumer: { groupId: 'reservation-notification-group' },
      },
    }]),
  ],
  controllers: [ReservationController],
  providers: [ReservationService],
})
export class ReservationModule {}
```

#### Kafka Event Emission (inside service)
```typescript
@Injectable()
export class ReservationService implements OnModuleInit {
  constructor(
    @Inject('NOTIFICATION_SERVICE') private readonly kafkaClient: ClientKafka,
    @InjectModel(Reservation.name) private reservationModel: Model<Reservation>,
  ) {}

  async onModuleInit() { await this.kafkaClient.connect(); }

  async createReservation(data: CreateReservationDto) {
    const reservation = await this.reservationModel.create(data);
    // Fire-and-forget notification event
    this.kafkaClient.emit('reservation_created', {
      userId: data.user_id,
      reservationId: reservation._id,
      listingId: data.listing_id,
      type: 'reservation_confirmation',
    });
    return { success: true, reservation };
  }
}
```

---

### 5.4 Listing Service (gRPC) — NEW

**Port:** `50061` | **Transport:** gRPC | **Proto package:** `listing`

#### Proto Definition (`proto/listing.proto`)
```protobuf
syntax = "proto3";
package listing;

service ListingService {
  rpc CreateListing(CreateListingRequest) returns (ListingResponse);
  rpc GetListing(GetListingRequest) returns (ListingResponse);
  rpc GetAllListings(GetAllListingsRequest) returns (ListingListResponse);
  rpc UpdateListing(UpdateListingRequest) returns (ListingResponse);
  rpc DeleteListing(DeleteListingRequest) returns (ListingResponse);
  rpc SearchListings(SearchListingsRequest) returns (ListingListResponse);
}

message CreateListingRequest {
  string owner_id = 1;
  string title = 2;
  string description = 3;
  double price_per_night = 4;
  string location = 5;
  repeated string images = 6;
  string category = 7;
  int32 max_guests = 8;
}

message Listing {
  string id = 1;
  string owner_id = 2;
  string title = 3;
  string description = 4;
  double price_per_night = 5;
  string location = 6;
  repeated string images = 7;
  string category = 8;
  int32 max_guests = 9;
  bool is_active = 10;
}
```

#### Entry Point (`main.ts`)
```typescript
async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'listing',
      protoPath: join(__dirname, 'proto/listing.proto'),
      url: process.env.GRPC_URL || '0.0.0.0:50061',
    },
  });
  await app.listen();
}
```

---

### 5.5 Notification Service (Kafka Consumer) — NEW

**Transport:** Kafka | **No gRPC port** (event-driven only)

#### Entry Point (`main.ts`)
```typescript
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'notification-service',
        brokers: [process.env.KAFKA_BROKER || 'localhost:29092'],
      },
      consumer: {
        groupId: 'notification-consumer-group',
      },
    },
  });
  await app.listen();
}
bootstrap();
```

#### Kafka Message Handlers
```typescript
import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // Fire-and-forget events (no response needed)
  @EventPattern('reservation_created')
  async handleReservationCreated(@Payload() data: any) {
    await this.notificationService.sendReservationConfirmation(data);
  }

  @EventPattern('reservation_cancelled')
  async handleReservationCancelled(@Payload() data: any) {
    await this.notificationService.sendCancellationNotice(data);
  }

  @EventPattern('send_email')
  async handleSendEmail(@Payload() data: any) {
    await this.notificationService.sendEmail(data);
  }

  @EventPattern('send_sms')
  async handleSendSms(@Payload() data: any) {
    await this.notificationService.sendSms(data);
  }

  @EventPattern('send_push_notification')
  async handlePushNotification(@Payload() data: any) {
    await this.notificationService.sendPushNotification(data);
  }
}
```

> **Pattern comparison:**
> - `@EventPattern('topic')` → fire-and-forget (producer uses `client.emit()`)
> - `@MessagePattern('topic')` → request-response (producer uses `client.send()`)

---

### 5.6 API Gateway (REST → gRPC Bridge)

**Port:** `3400` | **Transport:** HTTP (Express)

#### Entry Point (`main.ts`)
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new GrpcExceptionFilter());
  app.enableCors({ origin: '*', methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'], credentials: true });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('System API').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('api/v1', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT || 3400);
}
```

#### App Module (gRPC Client Connections)
```typescript
@Module({
  imports: [
    AuthModule,
    UserModule,
    ReservationModule,
    ListingModule,
    // Register gRPC clients
    ClientsModule.register([
      {
        name: 'AUTH_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: join(__dirname, 'proto/auth.proto'),
          url: process.env.AUTH_SERVICE_URL || 'localhost:50000',
        },
      },
      {
        name: 'USER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'user',
          protoPath: join(__dirname, 'proto/user.proto'),
          url: process.env.USER_SERVICE_URL || 'localhost:50053',
        },
      },
      {
        name: 'RESERVATION_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'reservation',
          protoPath: join(__dirname, 'proto/reservation.proto'),
          url: process.env.RESERVATION_SERVICE_URL || 'localhost:50060',
        },
      },
      {
        name: 'LISTING_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'listing',
          protoPath: join(__dirname, 'proto/listing.proto'),
          url: process.env.LISTING_SERVICE_URL || 'localhost:50061',
        },
      },
    ]),
    // Kafka client for notification events
    ClientsModule.register([{
      name: 'NOTIFICATION_SERVICE',
      transport: Transport.KAFKA,
      options: {
        client: { clientId: 'api-gateway', brokers: [process.env.KAFKA_BROKER || 'localhost:29092'] },
        consumer: { groupId: 'api-gateway-notification-group' },
      },
    }]),
  ],
})
export class AppModule {}
```

#### Gateway Controller Pattern (REST → gRPC)
```typescript
@ApiTags('Reservations')
@Controller('reservations')
export class ReservationController {
  private reservationService: any;

  constructor(@Inject('RESERVATION_PACKAGE') private client: ClientGrpcProxy) {
    this.reservationService = this.client.getService('ReservationService');
  }

  @Post()
  @ApiBearerAuth()
  async createReservation(@Body() dto: CreateReservationDto, @Req() req: any) {
    return await firstValueFrom(
      this.reservationService.CreateReservation({ userId: req.user.userId, ...dto }).pipe(
        catchError((error) => {
          throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        })
      )
    );
  }
}
```

---

## 6. Docker Compose — Complete

```yaml
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    container_name: zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "22181:2181"
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "nc", "-z", "localhost", "2181"]
      interval: 10s
      timeout: 5s
      retries: 5

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    container_name: kafka
    depends_on:
      zookeeper:
        condition: service_healthy
    ports:
      - "29092:29092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:29092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "kafka-broker-api-versions", "--bootstrap-server", "localhost:9092"]
      interval: 10s
      timeout: 10s
      retries: 5
      start_period: 40s

  auth-service:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        SERVICE_NAME: auth-service
    container_name: auth-service
    ports:
      - "50000:50000"
    environment:
      - GRPC_URL=0.0.0.0:50000
      - KAFKA_BROKER=kafka:9092
      - MONGO_URI=${MONGO_URI}
      - JWT_SECRET=${JWT_SECRET}
    networks:
      - app-network
    depends_on:
      kafka:
        condition: service_healthy
    restart: unless-stopped

  user-service:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        SERVICE_NAME: user-service
    container_name: user-service
    ports:
      - "50053:50053"
    environment:
      - GRPC_URL=0.0.0.0:50053
      - KAFKA_BROKER=kafka:9092
      - MONGO_URI=${MONGO_URI}
    networks:
      - app-network
    depends_on:
      kafka:
        condition: service_healthy
    restart: unless-stopped

  reservation-service:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        SERVICE_NAME: reservation-service
    container_name: reservation-service
    ports:
      - "50060:50060"
    environment:
      - GRPC_URL=0.0.0.0:50060
      - KAFKA_BROKER=kafka:9092
      - MONGO_URI=${MONGO_URI}
    networks:
      - app-network
    depends_on:
      kafka:
        condition: service_healthy
    restart: unless-stopped

  listing-service:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        SERVICE_NAME: listing-service
    container_name: listing-service
    ports:
      - "50061:50061"
    environment:
      - GRPC_URL=0.0.0.0:50061
      - KAFKA_BROKER=kafka:9092
      - MONGO_URI=${MONGO_URI}
    networks:
      - app-network
    depends_on:
      kafka:
        condition: service_healthy
    restart: unless-stopped

  notification-service:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        SERVICE_NAME: notification-service
    container_name: notification-service
    environment:
      - KAFKA_BROKER=kafka:9092
      - EMAIL_HOST=${EMAIL_HOST}
      - EMAIL_PORT=${EMAIL_PORT}
      - EMAIL_USER=${EMAIL_USER}
      - EMAIL_PASSWORD=${EMAIL_PASSWORD}
    networks:
      - app-network
    depends_on:
      kafka:
        condition: service_healthy
    restart: unless-stopped

  api-gateway:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        SERVICE_NAME: api-gateway
    container_name: api-gateway
    ports:
      - "3400:3400"
    environment:
      - PORT=3400
      - JWT_SECRET=${JWT_SECRET}
      - KAFKA_BROKER=kafka:9092
      - AUTH_SERVICE_URL=auth-service:50000
      - USER_SERVICE_URL=user-service:50053
      - RESERVATION_SERVICE_URL=reservation-service:50060
      - LISTING_SERVICE_URL=listing-service:50061
    networks:
      - app-network
    depends_on:
      - auth-service
      - user-service
      - reservation-service
      - listing-service
      - notification-service
    restart: unless-stopped

networks:
  app-network:
    driver: bridge
```

---

## 7. Shared Dockerfile (Multi-Stage)

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json nx.json tsconfig*.json ./
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/auth-service/package.json ./apps/auth-service/
COPY apps/user-service/package.json ./apps/user-service/
COPY apps/reservation-service/package.json ./apps/reservation-service/
COPY apps/listing-service/package.json ./apps/listing-service/
COPY apps/notification-service/package.json ./apps/notification-service/
RUN npm install --legacy-peer-deps

# Stage 2: Build
FROM deps AS builder
WORKDIR /app
COPY apps/ ./apps/
COPY proto/ ./proto/
ARG SERVICE_NAME
RUN npx nx build ${SERVICE_NAME} --configuration=production --skip-nx-cache

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init
ARG SERVICE_NAME
ENV NODE_ENV=production
COPY --from=builder /app/dist/apps/${SERVICE_NAME} ./dist/
RUN cd dist && npm install --omit=dev --legacy-peer-deps
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

---

## 8. Nx Configuration

### `nx.json` — Proto file copy for builds
```json
{
  "targetDefaults": {
    "build": {
      "options": {
        "assets": [
          {
            "glob": "*.proto",
            "input": "proto",
            "output": "proto"
          }
        ]
      }
    }
  }
}
```

> This ensures all `.proto` files from the shared `proto/` directory are copied into each service's `dist/` output during build.

---

## 9. Environment Variables (`.env`)

```env
# MongoDB
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/mydb

# JWT
JWT_SECRET=your-jwt-secret

# Email (for notification-service)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=app-password
EMAIL_FROM=MyApp <noreply@myapp.com>
```

---

## 10. Port Allocation Summary

| Service | Port | Transport | Protocol |
|---------|------|-----------|----------|
| API Gateway | 3400 | HTTP | REST |
| Auth Service | 50000 | gRPC | Protobuf |
| User Service | 50053 | gRPC | Protobuf |
| Reservation Service | 50060 | gRPC | Protobuf |
| Listing Service | 50061 | gRPC | Protobuf |
| Notification Service | — | Kafka | Event-driven |
| Zookeeper | 2181 (22181 ext) | TCP | ZAB |
| Kafka | 9092 (29092 ext) | TCP | Kafka Protocol |

---

## 11. Kafka Topics

| Topic | Producer | Consumer | Pattern |
|-------|----------|----------|---------|
| `reservation_created` | reservation-service | notification-service | `@EventPattern` (fire-and-forget) |
| `reservation_cancelled` | reservation-service | notification-service | `@EventPattern` |
| `send_email` | auth-service, api-gateway | notification-service | `@EventPattern` |
| `send_sms` | auth-service | notification-service | `@EventPattern` |
| `send_push_notification` | any service | notification-service | `@EventPattern` |
| `user_registered` | auth-service | notification-service | `@EventPattern` |

---

## 12. Quick Start Commands

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Generate a new service (example)
npx nx g @nx/nest:app reservation-service

# 3. Serve locally (individual service)
npx nx serve auth-service
npx nx serve api-gateway

# 4. Build all services
npx nx run-many --target=build --all

# 5. Run with Docker Compose
docker-compose up --build

# 6. Run specific services
docker-compose up kafka zookeeper auth-service api-gateway
```

---

## 13. Implementation Checklist

- [ ] Create `proto/reservation.proto` and `proto/listing.proto`
- [ ] Generate Nx apps: `reservation-service`, `listing-service`, `notification-service`
- [ ] Implement gRPC controllers with `@GrpcMethod` for reservation & listing
- [ ] Configure Kafka producer in reservation-service for notification events
- [ ] Implement Kafka consumer in notification-service with `@EventPattern`
- [ ] Add gateway modules for reservation & listing (REST → gRPC)
- [ ] Register gRPC clients in gateway `AppModule`
- [ ] Add Kafka client in gateway for direct notification events
- [ ] Update `Dockerfile` to include new service `package.json` files
- [ ] Update `docker-compose.yml` with all six services
- [ ] Update `nx.json` build assets to copy proto files
- [ ] Configure `.env` with all required variables
- [ ] Add Swagger decorators on all gateway controllers
- [ ] Add JWT guards and role-based access control
- [ ] Test all gRPC connections and Kafka event flows
