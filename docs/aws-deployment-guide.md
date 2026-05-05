# AWS Deployment Guide — Brinex Backend

Complete guide for deploying the Brinex NestJS microservices backend to AWS using **ECS on EC2**, **self-hosted Kafka on EC2**, and **GitHub Actions CI/CD**.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [VPC & Networking](#3-vpc--networking)
4. [ECR (Container Registry)](#4-ecr-container-registry)
5. [Self-Hosted Kafka on EC2](#5-self-hosted-kafka-on-ec2)
6. [Secrets Management](#6-aws-secrets-manager--ssm-parameter-store)
7. [SQS (Waste Valorization)](#7-sqs-for-waste-valorization-service)
8. [ECS on EC2 Deployment](#8-ecs-on-ec2-deployment)
9. [Application Load Balancer](#9-application-load-balancer-alb)
10. [DNS & SSL](#10-dns--ssl)
11. [GitHub Actions CI/CD](#11-github-actions-cicd-pipeline)
12. [Monitoring & Logging](#12-monitoring--logging)
13. [Security Checklist](#13-security-checklist)
14. [Cost Estimation](#14-cost-estimation)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Architecture Overview

```
                         ┌─────────────────────────────────────────────────────────────┐
                         │                        AWS VPC (10.0.0.0/16)               │
                         │                                                             │
   Internet              │  ┌─────────── Public Subnets (10.0.1.0/24, 10.0.2.0/24) ──┐│
      │                  │  │                                                          ││
      │    ┌─────────┐   │  │  ┌─────────────┐          ┌──────────────┐              ││
      ├───►│ Route 53 │───┼──┼─►│     ALB     │          │  NAT Gateway │              ││
      │    └─────────┘   │  │  │ (HTTPS:443) │          │  (Outbound)  │              ││
      │                  │  │  └──────┬──────┘          └──────┬───────┘              ││
      │                  │  └─────────┼────────────────────────┼───────────────────────┘│
      │                  │            │                        │                        │
      │                  │  ┌─────────┼────────────────────────┼───────────────────────┐│
      │                  │  │         │  Private Subnets (10.0.3.0/24, 10.0.4.0/24)   ││
      │                  │  │         ▼                        │                       ││
      │                  │  │  ┌──────────────┐                │                       ││
      │                  │  │  │ api-gateway  │◄── ECS on EC2 (2x t3.xlarge)           ││
      │                  │  │  │   (:3400)    │                │                       ││
      │                  │  │  └──────┬───────┘                │                       ││
      │                  │  │         │ gRPC                   │                       ││
      │                  │  │         ▼                        │                       ││
      │                  │  │  ┌──────────────────────────┐    │                       ││
      │                  │  │  │   gRPC Services (ECS)    │    │                       ││
      │                  │  │  │                          │    │                       ││
      │                  │  │  │  auth-service      :50000│    │                       ││
      │                  │  │  │  user-service      :50053│    │                       ││
      │                  │  │  │  crystal-service   :50054│    │                       ││
      │                  │  │  │  crystal-onnx      :50055│    │                       ││
      │                  │  │  │  payment-service   :50056│    │                       ││
      │                  │  │  │  vision-service    :50057│    │                       ││
      │                  │  │  │  compass-service   :50052│    │                       ││
      │                  │  │  │  waste-valor       :50058│    │                       ││
      │                  │  │  └──────────┬───────────────┘    │                       ││
      │                  │  │             │ Kafka              │                       ││
      │                  │  │             ▼                    │                       ││
      │                  │  │  ┌──────────────────┐            │                       ││
      │                  │  │  │  Kafka EC2        │            │                       ││
      │                  │  │  │  (t3.medium)      │            │                       ││
      │                  │  │  │  Broker :9092     │            │                       ││
      │                  │  │  │  ZK     :2181     │            │                       ││
      │                  │  │  └──────────────────┘            │                       ││
      │                  │  │             │                    │                       ││
      │                  │  │             ▼                    │                       ││
      │                  │  │  ┌──────────────────┐            │                       ││
      │                  │  │  │ Kafka Consumers   │            │                       ││
      │                  │  │  │  email-service    │            │                       ││
      │                  │  │  │  audit-log-service│            │                       ││
      │                  │  │  └──────────────────┘            │                       ││
      │                  │  └──────────────────────────────────┼───────────────────────┘│
      │                  │                                     │                        │
      │                  │                          ┌──────────▼──────────┐             │
      │                  │                          │   MongoDB Atlas     │             │
      │                  │                          │   (VPC Peering)     │             │
      │                  │                          └─────────────────────┘             │
      │                  └─────────────────────────────────────────────────────────────┘
```

### Service-to-Container Mapping

| Service | Image | Port | Transport | Notes |
|---------|-------|------|-----------|-------|
| api-gateway | `brinex/standard` | 3400 | HTTP + WebSocket | Public-facing via ALB |
| auth-service | `brinex/standard` | 50000 | gRPC + Kafka producer | OTP, JWT, OAuth |
| user-service | `brinex/standard` | 50053 | gRPC + Kafka producer | User CRUD |
| crystallization-service | `brinex/standard` | 50054 | gRPC | Calls ONNX service |
| crystallization-onnx-service | `brinex/onnx` | 50055 | gRPC | LSTM inference (glibc) |
| vision-service | `brinex/vision` | 50057 | gRPC | YOLOv8 + sharp (glibc) |
| payment-service | `brinex/standard` | 50056 | gRPC | PayHere gateway |
| compass-service | `brinex/standard` | 50052 | gRPC + Kafka | Trading/deals |
| waste-valorization-service | `brinex/standard` | 50058 | gRPC + SQS | Waste prediction |
| email-service | `brinex/standard` | — | Kafka consumer | Nodemailer + Pug |
| audit-log-service | `brinex/standard` | — | Kafka consumer | Event audit trail |

### Network Flow

```
Internet → ALB (HTTPS:443) → api-gateway (:3400) → gRPC services (private) → MongoDB Atlas
                                    ↕ Kafka
                              email-service / audit-log-service
```

---

## 2. Prerequisites

### AWS Requirements

- **AWS Account** with admin IAM user
- **AWS CLI v2** installed and configured (`aws configure`)
- **Docker CLI** installed (Docker Desktop or Docker Engine)

### External Services (Already Configured)

- **MongoDB Atlas** cluster — note the connection string (`MONGO_URI`)
- **Domain name** registered + **Route 53** hosted zone created
- **API keys** ready:
  - Notify.lk: `NOTIFY_LK_USER_ID`, `NOTIFY_LK_API_KEY`, `NOTIFY_LK_SENDER_ID`
  - PayHere: `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`
  - OpenWeatherMap: `OPENWEATHER_API_KEY`
  - SMTP credentials: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`
  - JWT signing key: `JWT_SECRET`

### Tools

```bash
# Verify installations
aws --version          # AWS CLI v2
docker --version       # Docker CLI
```

---

## 3. VPC & Networking

### 3.1 Create the VPC

```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=brinex-vpc}]' \
  --query 'Vpc.VpcId' --output text)

# Enable DNS hostnames (required for Cloud Map)
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-support
```

### 3.2 Create Subnets (2 AZs)

```bash
# Get available AZs
AZ1=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[0].ZoneName' --output text)
AZ2=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[1].ZoneName' --output text)

# Public subnets
PUB_SUBNET_1=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone $AZ1 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=brinex-public-1}]' \
  --query 'Subnet.SubnetId' --output text)

PUB_SUBNET_2=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone $AZ2 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=brinex-public-2}]' \
  --query 'Subnet.SubnetId' --output text)

# Private subnets
PRIV_SUBNET_1=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.3.0/24 --availability-zone $AZ1 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=brinex-private-1}]' \
  --query 'Subnet.SubnetId' --output text)

PRIV_SUBNET_2=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.4.0/24 --availability-zone $AZ2 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=brinex-private-2}]' \
  --query 'Subnet.SubnetId' --output text)

# Enable auto-assign public IPs on public subnets
aws ec2 modify-subnet-attribute --subnet-id $PUB_SUBNET_1 --map-public-ip-on-launch
aws ec2 modify-subnet-attribute --subnet-id $PUB_SUBNET_2 --map-public-ip-on-launch
```

### 3.3 Internet Gateway & NAT Gateway

```bash
# Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=brinex-igw}]' \
  --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID

# Elastic IP for NAT Gateway
EIP_ALLOC=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)

# NAT Gateway (in public subnet)
NAT_GW_ID=$(aws ec2 create-nat-gateway \
  --subnet-id $PUB_SUBNET_1 --allocation-id $EIP_ALLOC \
  --tag-specifications 'ResourceType=natgateway,Tags=[{Key=Name,Value=brinex-nat}]' \
  --query 'NatGateway.NatGatewayId' --output text)

# Wait for NAT Gateway to become available
aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT_GW_ID
```

### 3.4 Route Tables

```bash
# Public route table → Internet Gateway
PUB_RT=$(aws ec2 create-route-table --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=brinex-public-rt}]' \
  --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $PUB_RT --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
aws ec2 associate-route-table --route-table-id $PUB_RT --subnet-id $PUB_SUBNET_1
aws ec2 associate-route-table --route-table-id $PUB_RT --subnet-id $PUB_SUBNET_2

# Private route table → NAT Gateway
PRIV_RT=$(aws ec2 create-route-table --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=brinex-private-rt}]' \
  --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $PRIV_RT --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $NAT_GW_ID
aws ec2 associate-route-table --route-table-id $PRIV_RT --subnet-id $PRIV_SUBNET_1
aws ec2 associate-route-table --route-table-id $PRIV_RT --subnet-id $PRIV_SUBNET_2
```

### 3.5 Security Groups

```bash
# ALB Security Group — allows public HTTP/HTTPS
ALB_SG=$(aws ec2 create-security-group --group-name brinex-alb-sg \
  --description "ALB - public HTTP/HTTPS" --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 443 --cidr 0.0.0.0/0

# ECS Security Group — api-gateway from ALB + gRPC inter-service
ECS_SG=$(aws ec2 create-security-group --group-name brinex-ecs-sg \
  --description "ECS tasks - gRPC inter-service" --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 3400 --source-group $ALB_SG
aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 50000-50058 --source-group $ECS_SG

# Kafka Security Group — only ECS can reach Kafka
KAFKA_SG=$(aws ec2 create-security-group --group-name brinex-kafka-sg \
  --description "Kafka broker" --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $KAFKA_SG --protocol tcp --port 9092 --source-group $ECS_SG
aws ec2 authorize-security-group-ingress --group-id $KAFKA_SG --protocol tcp --port 2181 --source-group $KAFKA_SG

# Allow Kafka SG self-referencing (ZK ensemble)
aws ec2 authorize-security-group-ingress --group-id $KAFKA_SG --protocol tcp --port 2181 --source-group $KAFKA_SG
```

### 3.6 MongoDB Atlas VPC Peering

1. In **MongoDB Atlas** → Network Access → Peering:
   - Create peering connection to your AWS VPC
   - Provide: AWS Account ID, VPC ID (`$VPC_ID`), VPC CIDR (`10.0.0.0/16`), Region
2. In **AWS Console** → VPC → Peering Connections:
   - Accept the peering request
3. Add route to private route table:
   ```bash
   # Replace PEERING_ID and ATLAS_CIDR with your values
   aws ec2 create-route --route-table-id $PRIV_RT \
     --destination-cidr-block <ATLAS_VPC_CIDR> \
     --vpc-peering-connection-id <PEERING_ID>
   ```
4. In Atlas → Network Access → IP Access List:
   - Add the NAT Gateway Elastic IP (fallback) or the VPC CIDR if using peering

---

## 4. ECR (Container Registry)

### 4.1 Create Repositories

```bash
AWS_REGION=ap-southeast-1  # Change to your region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create 3 repos for the 3 Dockerfile variants
for REPO in brinex/standard brinex/vision brinex/onnx; do
  aws ecr create-repository --repository-name $REPO --region $AWS_REGION \
    --image-scanning-configuration scanOnPush=true
done
```

### 4.2 Build & Push Images

```bash
# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

ECR_BASE=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
GIT_SHA=$(git rev-parse --short HEAD)

cd Final-Year-Research-25-26J-431/
```

#### Standard Services (9 services — Alpine)

Uses the root `Dockerfile` with `SERVICE_NAME` build arg:

```bash
# Build and push each standard service
for SERVICE in api-gateway auth-service user-service crystallization-service \
               payment-service compass-service waste-valorization-service \
               email-service audit-log-service; do
  DOCKER_BUILDKIT=1 docker build \
    --build-arg SERVICE_NAME=$SERVICE \
    -t $ECR_BASE/brinex/standard:$SERVICE-$GIT_SHA \
    -t $ECR_BASE/brinex/standard:$SERVICE-latest \
    -f Dockerfile .

  docker push $ECR_BASE/brinex/standard:$SERVICE-$GIT_SHA
  docker push $ECR_BASE/brinex/standard:$SERVICE-latest
done
```

#### Vision Service (Debian Slim + ONNX + sharp)

```bash
DOCKER_BUILDKIT=1 docker build \
  --build-arg SERVICE_NAME=vision-service \
  -t $ECR_BASE/brinex/vision:$GIT_SHA \
  -t $ECR_BASE/brinex/vision:latest \
  -f apps/vision-service/Dockerfile .

docker push $ECR_BASE/brinex/vision:$GIT_SHA
docker push $ECR_BASE/brinex/vision:latest
```

#### Crystallization ONNX Service (Debian Slim + ONNX)

```bash
DOCKER_BUILDKIT=1 docker build \
  --build-arg SERVICE_NAME=crystallization-onnx-service \
  -t $ECR_BASE/brinex/onnx:$GIT_SHA \
  -t $ECR_BASE/brinex/onnx:latest \
  -f apps/crystallization-onnx-service/Dockerfile .

docker push $ECR_BASE/brinex/onnx:$GIT_SHA
docker push $ECR_BASE/brinex/onnx:latest
```

> **Note:** `DOCKER_BUILDKIT=1` is required for the `--mount=type=cache` directives in the Dockerfiles.

---

## 5. Self-Hosted Kafka on EC2

### 5.1 Launch EC2 Instance

```bash
# Find latest Amazon Linux 2023 AMI
AL2023_AMI=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-2023*-x86_64" "Name=state,Values=available" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' --output text)

# Launch Kafka instance in private subnet
KAFKA_INSTANCE=$(aws ec2 run-instances \
  --image-id $AL2023_AMI \
  --instance-type t3.medium \
  --subnet-id $PRIV_SUBNET_1 \
  --security-group-ids $KAFKA_SG \
  --key-name <your-key-pair> \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=brinex-kafka}]' \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":50,"VolumeType":"gp3"}}]' \
  --query 'Instances[0].InstanceId' --output text)

# Get private IP (used for KAFKA_BROKER env var)
KAFKA_PRIVATE_IP=$(aws ec2 describe-instances --instance-ids $KAFKA_INSTANCE \
  --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text)
echo "Kafka Private IP: $KAFKA_PRIVATE_IP"
```

### 5.2 Install Kafka + Zookeeper

SSH into the Kafka EC2 instance (via a bastion or SSM Session Manager) and run:

```bash
# Install Java (required for Kafka)
sudo dnf install -y java-17-amazon-corretto-headless

# Download Confluent Platform (or Apache Kafka)
KAFKA_VERSION=7.5.0
SCALA_VERSION=2.13
curl -O https://packages.confluent.io/archive/7.5/confluent-community-${KAFKA_VERSION}.tar.gz
tar -xzf confluent-community-${KAFKA_VERSION}.tar.gz
sudo mv confluent-${KAFKA_VERSION} /opt/kafka

# Create data directories
sudo mkdir -p /var/kafka-data /var/zookeeper-data
sudo chown -R ec2-user:ec2-user /var/kafka-data /var/zookeeper-data
```

### 5.3 Configure Zookeeper

```bash
cat > /opt/kafka/etc/kafka/zookeeper.properties << 'EOF'
dataDir=/var/zookeeper-data
clientPort=2181
maxClientCnxns=60
admin.enableServer=false
EOF
```

### 5.4 Configure Kafka Broker

```bash
PRIVATE_IP=$(hostname -I | awk '{print $1}')

cat > /opt/kafka/etc/kafka/server.properties << EOF
broker.id=1
listeners=PLAINTEXT://0.0.0.0:9092
advertised.listeners=PLAINTEXT://${PRIVATE_IP}:9092
num.network.threads=3
num.io.threads=8
socket.send.buffer.bytes=102400
socket.receive.buffer.bytes=102400
socket.request.max.bytes=104857600
log.dirs=/var/kafka-data
num.partitions=3
num.recovery.threads.per.data.dir=1
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1
log.retention.hours=168
log.retention.bytes=1073741824
zookeeper.connect=localhost:2181
zookeeper.connection.timeout.ms=18000
group.initial.rebalance.delay.ms=0
EOF
```

### 5.5 Create systemd Service Units

```bash
# Zookeeper service
sudo tee /etc/systemd/system/zookeeper.service > /dev/null << 'EOF'
[Unit]
Description=Apache Zookeeper
After=network.target

[Service]
Type=simple
User=ec2-user
ExecStart=/opt/kafka/bin/zookeeper-server-start /opt/kafka/etc/kafka/zookeeper.properties
ExecStop=/opt/kafka/bin/zookeeper-server-stop
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Kafka service
sudo tee /etc/systemd/system/kafka.service > /dev/null << 'EOF'
[Unit]
Description=Apache Kafka
After=zookeeper.service
Requires=zookeeper.service

[Service]
Type=simple
User=ec2-user
Environment="KAFKA_HEAP_OPTS=-Xmx1G -Xms1G"
ExecStart=/opt/kafka/bin/kafka-server-start /opt/kafka/etc/kafka/server.properties
ExecStop=/opt/kafka/bin/kafka-server-stop
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start services
sudo systemctl daemon-reload
sudo systemctl enable zookeeper kafka
sudo systemctl start zookeeper
sudo systemctl start kafka
```

### 5.6 Create Required Topics

```bash
/opt/kafka/bin/kafka-topics --bootstrap-server localhost:9092 --create \
  --topic send_verification_code_email --partitions 3 --replication-factor 1

/opt/kafka/bin/kafka-topics --bootstrap-server localhost:9092 --create \
  --topic create_audit_log --partitions 3 --replication-factor 1

# Verify
/opt/kafka/bin/kafka-topics --bootstrap-server localhost:9092 --list
```

---

## 6. AWS Secrets Manager / SSM Parameter Store

### 6.1 Store Secrets

```bash
# MongoDB connection string
aws secretsmanager create-secret --name brinex/MONGO_URI \
  --secret-string "mongodb+srv://user:pass@cluster.mongodb.net/brinex"

# JWT secret
aws secretsmanager create-secret --name brinex/JWT_SECRET \
  --secret-string "your-jwt-secret-key"

# Notify.lk SMS
aws secretsmanager create-secret --name brinex/NOTIFY_LK \
  --secret-string '{"USER_ID":"xxx","API_KEY":"xxx","SENDER_ID":"NotifyDEMO"}'

# PayHere
aws secretsmanager create-secret --name brinex/PAYHERE \
  --secret-string '{"MERCHANT_ID":"xxx","MERCHANT_SECRET":"xxx"}'

# Email
aws secretsmanager create-secret --name brinex/EMAIL \
  --secret-string '{"HOST":"smtp.gmail.com","PORT":"587","USER":"xxx@gmail.com","PASS":"xxx","FROM":"BrineX <noreply@brinex.com>"}'

# OpenWeather
aws secretsmanager create-secret --name brinex/OPENWEATHER_API_KEY \
  --secret-string "your-openweather-api-key"
```

### 6.2 IAM Policy for ECS Task Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:<REGION>:<ACCOUNT_ID>:secret:brinex/*"
    }
  ]
}
```

```bash
# Create ECS task execution role
aws iam create-role --role-name brinex-ecs-task-execution-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach managed policy for ECR pull + CloudWatch logs
aws iam attach-role-policy --role-name brinex-ecs-task-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Attach Secrets Manager read policy
aws iam put-role-policy --role-name brinex-ecs-task-execution-role \
  --policy-name SecretsManagerRead \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:*:*:secret:brinex/*"
    }]
  }'

# Create ECS task role (for application-level AWS access, e.g., SQS)
aws iam create-role --role-name brinex-ecs-task-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'
```

---

## 7. SQS (for Waste Valorization Service)

The waste-valorization-service uses a FIFO SQS queue for prediction job processing.

### 7.1 Create the Queue

```bash
QUEUE_URL=$(aws sqs create-queue \
  --queue-name production_waste_prediction_requests.fifo \
  --attributes '{
    "FifoQueue": "true",
    "ContentBasedDeduplication": "false",
    "VisibilityTimeout": "300",
    "MessageRetentionPeriod": "86400"
  }' \
  --query 'QueueUrl' --output text)

echo "SQS Queue URL: $QUEUE_URL"
```

### 7.2 IAM Policy for SQS Access

Attach to `brinex-ecs-task-role` (replaces the hardcoded AWS keys in the service):

```bash
aws iam put-role-policy --role-name brinex-ecs-task-role \
  --policy-name SQSAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl"
      ],
      "Resource": "arn:aws:sqs:*:*:production_waste_prediction_requests.fifo"
    }]
  }'
```

> **Important:** After deploying, remove the hardcoded `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from the waste-valorization-service configuration. The ECS task role provides credentials automatically via the instance metadata service.

---

## 8. ECS on EC2 Deployment

### 8.1 ECS Cluster + EC2 Instances

#### Create ECS Cluster

```bash
aws ecs create-cluster --cluster-name brinex-cluster \
  --settings '[{"name":"containerInsights","value":"enabled"}]'
```

#### IAM Instance Profile for EC2

```bash
# Create EC2 instance role
aws iam create-role --role-name brinex-ecs-instance-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy --role-name brinex-ecs-instance-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role

aws iam attach-role-policy --role-name brinex-ecs-instance-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

# Create instance profile
aws iam create-instance-profile --instance-profile-name brinex-ecs-instance-profile
aws iam add-role-to-instance-profile \
  --instance-profile-name brinex-ecs-instance-profile \
  --role-name brinex-ecs-instance-role
```

#### Launch Template for ECS EC2 Instances

```bash
# Find latest ECS-optimized Amazon Linux 2023 AMI
ECS_AMI=$(aws ssm get-parameters \
  --names /aws/service/ecs/optimized-ami/amazon-linux-2023/recommended/image_id \
  --query 'Parameters[0].Value' --output text)

# User data to register with ECS cluster
USER_DATA=$(cat << 'EOF' | base64
#!/bin/bash
echo "ECS_CLUSTER=brinex-cluster" >> /etc/ecs/ecs.config
echo "ECS_ENABLE_CONTAINER_METADATA=true" >> /etc/ecs/ecs.config
echo "ECS_ENABLE_TASK_IAM_ROLE=true" >> /etc/ecs/ecs.config
EOF
)

aws ec2 create-launch-template \
  --launch-template-name brinex-ecs-launch-template \
  --launch-template-data "{
    \"ImageId\": \"$ECS_AMI\",
    \"InstanceType\": \"t3.xlarge\",
    \"IamInstanceProfile\": {\"Name\": \"brinex-ecs-instance-profile\"},
    \"SecurityGroupIds\": [\"$ECS_SG\"],
    \"UserData\": \"$USER_DATA\",
    \"BlockDeviceMappings\": [{
      \"DeviceName\": \"/dev/xvda\",
      \"Ebs\": {\"VolumeSize\": 50, \"VolumeType\": \"gp3\"}
    }],
    \"TagSpecifications\": [{
      \"ResourceType\": \"instance\",
      \"Tags\": [{\"Key\": \"Name\", \"Value\": \"brinex-ecs-node\"}]
    }]
  }"
```

#### Auto Scaling Group

```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name brinex-ecs-asg \
  --launch-template "LaunchTemplateName=brinex-ecs-launch-template,Version=\$Latest" \
  --min-size 2 --max-size 4 --desired-capacity 2 \
  --vpc-zone-identifier "$PRIV_SUBNET_1,$PRIV_SUBNET_2" \
  --tags "Key=Name,Value=brinex-ecs-node,PropagateAtLaunch=true"
```

> **Instance sizing:** 2x `t3.xlarge` (4 vCPU, 16 GB each = 8 vCPU, 32 GB total) provides capacity for all 11 services. Total resource allocation: ~4,608 CPU units + ~9,216 MB memory.

### 8.2 Task Definitions (11 Services)

#### Resource Allocations

| Service | CPU | Memory (MB) | Image Repo | Port |
|---------|-----|-------------|------------|------|
| api-gateway | 512 | 1024 | brinex/standard | 3400 |
| auth-service | 256 | 512 | brinex/standard | 50000 |
| user-service | 256 | 512 | brinex/standard | 50053 |
| crystallization-service | 256 | 512 | brinex/standard | 50054 |
| crystallization-onnx-service | 1024 | 2048 | brinex/onnx | 50055 |
| vision-service | 1024 | 2048 | brinex/vision | 50057 |
| payment-service | 256 | 512 | brinex/standard | 50056 |
| compass-service | 256 | 512 | brinex/standard | 50052 |
| waste-valorization-service | 256 | 512 | brinex/standard | 50058 |
| email-service | 256 | 512 | brinex/standard | — |
| audit-log-service | 256 | 512 | brinex/standard | — |

#### Example: api-gateway Task Definition

```bash
cat > /tmp/api-gateway-task.json << 'EOF'
{
  "family": "brinex-api-gateway",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/brinex-ecs-task-execution-role",
  "taskRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/brinex-ecs-task-role",
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "api-gateway",
      "image": "<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/brinex/standard:api-gateway-latest",
      "cpu": 512,
      "memory": 1024,
      "essential": true,
      "portMappings": [
        {"containerPort": 3400, "protocol": "tcp"}
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "AUTH_SERVICE_URL", "value": "auth-service.brinex.local:50000"},
        {"name": "USER_SERVICE_URL", "value": "user-service.brinex.local:50053"},
        {"name": "CRYSTALLIZATION_SERVICE_URL", "value": "crystallization-service.brinex.local:50054"},
        {"name": "VISION_SERVICE_URL", "value": "vision-service.brinex.local:50057"},
        {"name": "PAYMENT_SERVICE_URL", "value": "payment-service.brinex.local:50056"},
        {"name": "COMPASS_SERVICE_URL", "value": "compass-service.brinex.local:50052"},
        {"name": "WASTE_VALORIZATION_SERVICE_URL", "value": "waste-valorization-service.brinex.local:50058"},
        {"name": "KAFKA_BROKER", "value": "<KAFKA_PRIVATE_IP>:9092"}
      ],
      "secrets": [
        {"name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:<REGION>:<ACCOUNT_ID>:secret:brinex/JWT_SECRET"},
        {"name": "MONGO_URI", "valueFrom": "arn:aws:secretsmanager:<REGION>:<ACCOUNT_ID>:secret:brinex/MONGO_URI"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/api-gateway",
          "awslogs-region": "<REGION>",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3400/api/v1/vision/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))\""],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

# Replace placeholders and register
sed -i "s/<ACCOUNT_ID>/$AWS_ACCOUNT_ID/g; s/<REGION>/$AWS_REGION/g; s/<KAFKA_PRIVATE_IP>/$KAFKA_PRIVATE_IP/g" \
  /tmp/api-gateway-task.json
aws ecs register-task-definition --cli-input-json file:///tmp/api-gateway-task.json
```

#### Example: auth-service Task Definition

```bash
cat > /tmp/auth-service-task.json << 'EOF'
{
  "family": "brinex-auth-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/brinex-ecs-task-execution-role",
  "taskRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/brinex-ecs-task-role",
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "auth-service",
      "image": "<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/brinex/standard:auth-service-latest",
      "cpu": 256,
      "memory": 512,
      "essential": true,
      "portMappings": [
        {"containerPort": 50000, "protocol": "tcp"}
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "GRPC_URL", "value": "0.0.0.0:50000"},
        {"name": "KAFKA_BROKER", "value": "<KAFKA_PRIVATE_IP>:9092"}
      ],
      "secrets": [
        {"name": "MONGO_URI", "valueFrom": "arn:aws:secretsmanager:<REGION>:<ACCOUNT_ID>:secret:brinex/MONGO_URI"},
        {"name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:<REGION>:<ACCOUNT_ID>:secret:brinex/JWT_SECRET"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/auth-service",
          "awslogs-region": "<REGION>",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF

sed -i "s/<ACCOUNT_ID>/$AWS_ACCOUNT_ID/g; s/<REGION>/$AWS_REGION/g; s/<KAFKA_PRIVATE_IP>/$KAFKA_PRIVATE_IP/g" \
  /tmp/auth-service-task.json
aws ecs register-task-definition --cli-input-json file:///tmp/auth-service-task.json
```

#### Example: vision-service Task Definition (Debian Slim)

```bash
cat > /tmp/vision-service-task.json << 'EOF'
{
  "family": "brinex-vision-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/brinex-ecs-task-execution-role",
  "taskRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/brinex-ecs-task-role",
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "vision-service",
      "image": "<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/brinex/vision:latest",
      "cpu": 1024,
      "memory": 2048,
      "essential": true,
      "portMappings": [
        {"containerPort": 50057, "protocol": "tcp"}
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "GRPC_URL", "value": "0.0.0.0:50057"},
        {"name": "VISION_MODEL_PATH", "value": "/app/models/best.onnx"}
      ],
      "secrets": [
        {"name": "MONGO_URI", "valueFrom": "arn:aws:secretsmanager:<REGION>:<ACCOUNT_ID>:secret:brinex/MONGO_URI"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/vision-service",
          "awslogs-region": "<REGION>",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF

sed -i "s/<ACCOUNT_ID>/$AWS_ACCOUNT_ID/g; s/<REGION>/$AWS_REGION/g" /tmp/vision-service-task.json
aws ecs register-task-definition --cli-input-json file:///tmp/vision-service-task.json
```

#### Example: crystallization-onnx-service Task Definition

```bash
cat > /tmp/crystallization-onnx-task.json << 'EOF'
{
  "family": "brinex-crystallization-onnx-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/brinex-ecs-task-execution-role",
  "taskRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/brinex-ecs-task-role",
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "crystallization-onnx-service",
      "image": "<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/brinex/onnx:latest",
      "cpu": 1024,
      "memory": 2048,
      "essential": true,
      "portMappings": [
        {"containerPort": 50055, "protocol": "tcp"}
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "GRPC_URL", "value": "0.0.0.0:50055"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/crystallization-onnx-service",
          "awslogs-region": "<REGION>",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF

sed -i "s/<ACCOUNT_ID>/$AWS_ACCOUNT_ID/g; s/<REGION>/$AWS_REGION/g" /tmp/crystallization-onnx-task.json
aws ecs register-task-definition --cli-input-json file:///tmp/crystallization-onnx-task.json
```

#### Remaining Services — Environment Variables Reference

Create task definitions for each remaining service following the same pattern. Key environment variables per service:

| Service | Environment Variables | Secrets |
|---------|----------------------|---------|
| **user-service** | `GRPC_URL=0.0.0.0:50053`, `KAFKA_BROKER=<KAFKA_IP>:9092` | `MONGO_URI` |
| **crystallization-service** | `GRPC_URL=0.0.0.0:50054`, `KAFKA_BROKER=<KAFKA_IP>:9092`, `ONNX_SERVICE_GRPC_URL=crystallization-onnx-service.brinex.local:50055`, `OPENWEATHER_LAT=8.061542`, `OPENWEATHER_LON=79.814714` | `MONGO_URI`, `OPENWEATHER_API_KEY` |
| **payment-service** | `GRPC_URL=0.0.0.0:50056`, `AUTH_SERVICE_URL=auth-service.brinex.local:50000`, `PAYHERE_SANDBOX=false`, `PAYHERE_NOTIFY_URL=https://<DOMAIN>/api/v1/payments/notify`, `FRONTEND_URL=https://<FRONTEND_DOMAIN>` | `MONGO_URI`, `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET` |
| **compass-service** | `GRPC_URL=0.0.0.0:50052`, `KAFKA_BROKER=<KAFKA_IP>:9092` | `MONGO_URI` |
| **waste-valorization-service** | `GRPC_URL=0.0.0.0:50058`, `KAFKA_BROKER=<KAFKA_IP>:9092`, `AWS_SQS_QUEUE_URL=<QUEUE_URL>`, `ENVIRONMENT=prod` | `MONGO_URI` |
| **email-service** | `KAFKA_BROKER=<KAFKA_IP>:9092` | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` |
| **audit-log-service** | `KAFKA_BROKER=<KAFKA_IP>:9092` | `MONGO_URI` |

### 8.3 Service Discovery (AWS Cloud Map)

```bash
# Create private DNS namespace
NAMESPACE_ID=$(aws servicediscovery create-private-dns-namespace \
  --name brinex.local \
  --vpc $VPC_ID \
  --query 'OperationId' --output text)

# Wait for namespace creation
aws servicediscovery get-operation --operation-id $NAMESPACE_ID

# Get namespace ID
NS_ID=$(aws servicediscovery list-namespaces \
  --query "Namespaces[?Name=='brinex.local'].Id" --output text)

# Create service discovery entries for each gRPC service
for SVC in auth-service user-service crystallization-service crystallization-onnx-service \
           vision-service payment-service compass-service waste-valorization-service \
           api-gateway email-service audit-log-service; do
  aws servicediscovery create-service \
    --name $SVC \
    --namespace-id $NS_ID \
    --dns-config "NamespaceId=$NS_ID,DnsRecords=[{Type=A,TTL=10}]" \
    --health-check-custom-config "FailureThreshold=1"
done
```

Each ECS service will automatically register/deregister with Cloud Map, creating DNS records like:
- `auth-service.brinex.local` → private IP of auth-service task
- `vision-service.brinex.local` → private IP of vision-service task

### 8.4 ECS Services (11 Services)

#### Create CloudWatch Log Groups

```bash
for SVC in api-gateway auth-service user-service crystallization-service \
           crystallization-onnx-service vision-service payment-service \
           compass-service waste-valorization-service email-service audit-log-service; do
  aws logs create-log-group --log-group-name /ecs/brinex/$SVC
  aws logs put-retention-policy --log-group-name /ecs/brinex/$SVC --retention-in-days 30
done
```

#### Create ECS Services

```bash
# Get Cloud Map service discovery ARNs
# Run for each service:
SD_ARN=$(aws servicediscovery list-services \
  --query "Services[?Name=='<SERVICE_NAME>'].Arn" --output text)

# Example: api-gateway (the only one with ALB integration)
aws ecs create-service \
  --cluster brinex-cluster \
  --service-name api-gateway \
  --task-definition brinex-api-gateway \
  --desired-count 1 \
  --launch-type EC2 \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIV_SUBNET_1,$PRIV_SUBNET_2],securityGroups=[$ECS_SG]}" \
  --service-registries "registryArn=$SD_ARN" \
  --load-balancers "targetGroupArn=<TG_ARN>,containerName=api-gateway,containerPort=3400" \
  --deployment-configuration "minimumHealthyPercent=50,maximumPercent=200" \
  --scheduling-strategy REPLICA

# All other services (no ALB, just Cloud Map)
for SVC in auth-service user-service crystallization-service crystallization-onnx-service \
           vision-service payment-service compass-service waste-valorization-service \
           email-service audit-log-service; do

  SD_ARN=$(aws servicediscovery list-services \
    --query "Services[?Name=='$SVC'].Arn" --output text)

  aws ecs create-service \
    --cluster brinex-cluster \
    --service-name $SVC \
    --task-definition brinex-$SVC \
    --desired-count 1 \
    --launch-type EC2 \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIV_SUBNET_1,$PRIV_SUBNET_2],securityGroups=[$ECS_SG]}" \
    --service-registries "registryArn=$SD_ARN" \
    --deployment-configuration "minimumHealthyPercent=50,maximumPercent=200" \
    --scheduling-strategy REPLICA
done
```

---

## 9. Application Load Balancer (ALB)

### 9.1 Create ALB

```bash
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name brinex-alb \
  --subnets $PUB_SUBNET_1 $PUB_SUBNET_2 \
  --security-groups $ALB_SG \
  --scheme internet-facing \
  --type application \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' --output text)

echo "ALB DNS: $ALB_DNS"
```

### 9.2 Create Target Group

```bash
TG_ARN=$(aws elbv2 create-target-group \
  --name brinex-api-gateway-tg \
  --protocol HTTP \
  --port 3400 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /api/v1/vision/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 10 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# Enable sticky sessions for WebSocket support
aws elbv2 modify-target-group-attributes \
  --target-group-arn $TG_ARN \
  --attributes Key=stickiness.enabled,Value=true Key=stickiness.type,Value=lb_cookie Key=stickiness.lb_cookie.duration_seconds,Value=86400
```

### 9.3 ALB Listeners

```bash
# HTTPS listener (after ACM certificate is created — see Section 10)
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=<ACM_CERT_ARN> \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN

# HTTP → HTTPS redirect
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'
```

### 9.4 WebSocket Configuration

ALB natively supports WebSocket connections. Configure the idle timeout for long-lived Socket.io connections:

```bash
# Increase idle timeout to 300s (default 60s)
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn $ALB_ARN \
  --attributes Key=idle_timeout.timeout_seconds,Value=300
```

---

## 10. DNS & SSL

### 10.1 ACM Certificate

```bash
# Request certificate
CERT_ARN=$(aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS \
  --query 'CertificateArn' --output text)

# Get DNS validation records
aws acm describe-certificate --certificate-arn $CERT_ARN \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'
```

### 10.2 Route 53 DNS Records

```bash
HOSTED_ZONE_ID=<your-hosted-zone-id>

# Add CNAME for ACM validation (use values from previous command)
aws route53 change-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "<VALIDATION_CNAME_NAME>",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "<VALIDATION_CNAME_VALUE>"}]
      }
    }]
  }'

# Wait for validation
aws acm wait certificate-validated --certificate-arn $CERT_ARN

# Create A record (alias) pointing to ALB
aws route53 change-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.yourdomain.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "<ALB_HOSTED_ZONE_ID>",
          "DNSName": "'$ALB_DNS'",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

### 10.3 Update Application URLs

After DNS is live, update these environment variables in the relevant task definitions:

```
PAYHERE_NOTIFY_URL=https://api.yourdomain.com/api/v1/payments/notify
FRONTEND_URL=https://yourdomain.com
```

---

## 11. GitHub Actions CI/CD Pipeline

Extend the existing 10 per-service CI workflows to add a deployment job. Each workflow already has `test` and `build` jobs with path-filtered triggers.

### 11.1 GitHub Secrets Required

Add these to the repository settings (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM user access key with ECR + ECS permissions |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `AWS_REGION` | e.g., `ap-southeast-1` |
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID |

### 11.2 Example: Extended api-gateway Workflow

Add a `deploy` job to `.github/workflows/api-gateway-ci.yml`:

```yaml
name: API Gateway CI/CD

on:
  push:
    branches: [master, develop]
    paths:
      - 'apps/api-gateway/**'
      - 'proto/**'
      - 'packages/**'
      - 'types/**'
  pull_request:
    paths:
      - 'apps/api-gateway/**'
      - 'proto/**'
      - 'packages/**'
      - 'types/**'
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install --legacy-peer-deps
      - name: Lint
        run: npx eslint apps/api-gateway/src --ext .ts --max-warnings 0
        continue-on-error: true
      - name: Test
        run: npx jest --config apps/api-gateway/jest.config.js --ci --passWithNoTests
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: api-gateway-test-results
          path: apps/api-gateway/test-output
          retention-days: 7

  build:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install --legacy-peer-deps
      - name: Build
        run: npx nx build api-gateway --skip-nx-cache
        env:
          NX_NO_CLOUD: true
      - uses: actions/upload-artifact@v4
        with:
          name: api-gateway-dist
          path: apps/api-gateway/dist
          retention-days: 7

  deploy:
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/master' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Login to Amazon ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          DOCKER_BUILDKIT=1 docker build \
            --build-arg SERVICE_NAME=api-gateway \
            -t $ECR_REGISTRY/brinex/standard:api-gateway-$IMAGE_TAG \
            -t $ECR_REGISTRY/brinex/standard:api-gateway-latest \
            -f Dockerfile .
          docker push $ECR_REGISTRY/brinex/standard:api-gateway-$IMAGE_TAG
          docker push $ECR_REGISTRY/brinex/standard:api-gateway-latest

      - name: Download current task definition
        run: |
          aws ecs describe-task-definition --task-definition brinex-api-gateway \
            --query taskDefinition > /tmp/task-def.json

      - name: Update task definition with new image
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: /tmp/task-def.json
          container-name: api-gateway
          image: ${{ steps.ecr-login.outputs.registry }}/brinex/standard:api-gateway-${{ github.sha }}

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: api-gateway
          cluster: brinex-cluster
          wait-for-service-stability: true
```

### 11.3 Example: Vision Service Workflow (Custom Dockerfile)

The `deploy` job for vision-service differs only in the Docker build step:

```yaml
  deploy:
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/master' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Login to Amazon ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          DOCKER_BUILDKIT=1 docker build \
            --build-arg SERVICE_NAME=vision-service \
            -t $ECR_REGISTRY/brinex/vision:$IMAGE_TAG \
            -t $ECR_REGISTRY/brinex/vision:latest \
            -f apps/vision-service/Dockerfile .
          docker push $ECR_REGISTRY/brinex/vision:$IMAGE_TAG
          docker push $ECR_REGISTRY/brinex/vision:latest

      - name: Download current task definition
        run: |
          aws ecs describe-task-definition --task-definition brinex-vision-service \
            --query taskDefinition > /tmp/task-def.json

      - name: Update task definition with new image
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: /tmp/task-def.json
          container-name: vision-service
          image: ${{ steps.ecr-login.outputs.registry }}/brinex/vision:${{ github.sha }}

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: vision-service
          cluster: brinex-cluster
          wait-for-service-stability: true
```

### 11.4 Pattern for All Services

Apply the same `deploy` job to all 10 workflow files. The only differences are:

| Workflow | `SERVICE_NAME` | ECR Repo | Dockerfile | Task Family | Container Name |
|----------|---------------|----------|-----------|-------------|----------------|
| api-gateway-ci | api-gateway | brinex/standard | Dockerfile | brinex-api-gateway | api-gateway |
| auth-service-ci | auth-service | brinex/standard | Dockerfile | brinex-auth-service | auth-service |
| audit-log-service-ci | audit-log-service | brinex/standard | Dockerfile | brinex-audit-log-service | audit-log-service |
| compass-service-ci | compass-service | brinex/standard | Dockerfile | brinex-compass-service | compass-service |
| crystallization-onnx-service-ci | crystallization-onnx-service | brinex/onnx | apps/crystallization-onnx-service/Dockerfile | brinex-crystallization-onnx-service | crystallization-onnx-service |
| crystallization-service-ci | crystallization-service | brinex/standard | Dockerfile | brinex-crystallization-service | crystallization-service |
| email-service-ci | email-service | brinex/standard | Dockerfile | brinex-email-service | email-service |
| payment-service-ci | payment-service | brinex/standard | Dockerfile | brinex-payment-service | payment-service |
| user-service-ci | user-service | brinex/standard | Dockerfile | brinex-user-service | user-service |
| vision-service-ci | vision-service | brinex/vision | apps/vision-service/Dockerfile | brinex-vision-service | vision-service |

> **Note:** The `waste-valorization-service` does not have an existing CI workflow. Create one following the same pattern as the other standard services.

---

## 12. Monitoring & Logging

### 12.1 CloudWatch Logs

All ECS tasks are configured with the `awslogs` log driver. Logs are sent to:

```
/ecs/brinex/api-gateway
/ecs/brinex/auth-service
/ecs/brinex/user-service
/ecs/brinex/crystallization-service
/ecs/brinex/crystallization-onnx-service
/ecs/brinex/vision-service
/ecs/brinex/payment-service
/ecs/brinex/compass-service
/ecs/brinex/waste-valorization-service
/ecs/brinex/email-service
/ecs/brinex/audit-log-service
```

View logs:

```bash
# Tail logs for a service
aws logs tail /ecs/brinex/api-gateway --follow

# Search logs
aws logs filter-log-events \
  --log-group-name /ecs/brinex/api-gateway \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s000)
```

### 12.2 CloudWatch Alarms

```bash
# CPU alarm for ECS cluster
aws cloudwatch put-metric-alarm \
  --alarm-name brinex-ecs-cpu-high \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=ClusterName,Value=brinex-cluster \
  --alarm-actions <SNS_TOPIC_ARN>

# Memory alarm
aws cloudwatch put-metric-alarm \
  --alarm-name brinex-ecs-memory-high \
  --metric-name MemoryUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=ClusterName,Value=brinex-cluster \
  --alarm-actions <SNS_TOPIC_ARN>

# ALB unhealthy targets alarm
aws cloudwatch put-metric-alarm \
  --alarm-name brinex-alb-unhealthy-targets \
  --metric-name UnHealthyHostCount \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 60 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 3 \
  --dimensions Name=TargetGroup,Value=<TG_DIMENSION> Name=LoadBalancer,Value=<ALB_DIMENSION> \
  --alarm-actions <SNS_TOPIC_ARN>
```

### 12.3 Container Insights (Optional)

Already enabled during cluster creation (`containerInsights=enabled`). Provides:
- Per-service CPU/memory metrics
- Network I/O
- Task-level metrics

> **Note:** Container Insights incurs additional CloudWatch costs (~$0.01/metric/month).

---

## 13. Security Checklist

### Critical Items

- [ ] **Remove hardcoded MongoDB credentials** from `app.module.ts` files across all services — use `MONGO_URI` from Secrets Manager instead
- [ ] **Remove hardcoded AWS keys** from waste-valorization-service — use IAM task role
- [ ] **All gRPC services in private subnets** — no public IP assigned
- [ ] **Only api-gateway** is reachable from ALB (port 3400)
- [ ] **Kafka only reachable** from ECS security group (port 9092)

### Network Security

- [ ] ALB security group: only 80/443 from `0.0.0.0/0`
- [ ] ECS security group: 3400 from ALB SG only, 50000-50058 from self only
- [ ] Kafka security group: 9092 from ECS SG only
- [ ] NAT Gateway for outbound internet (private subnets have no direct internet access)

### MongoDB Atlas

- [ ] VPC peering configured (preferred) OR NAT Gateway Elastic IP whitelisted
- [ ] Database user has minimum required permissions
- [ ] Connection string uses `mongodb+srv://` with TLS

### Secrets

- [ ] All secrets stored in AWS Secrets Manager (not in environment variables or source code)
- [ ] ECS task execution role has narrowly scoped Secrets Manager access
- [ ] JWT_SECRET is unique and strong (256-bit minimum)
- [ ] PayHere sandbox mode disabled in production (`PAYHERE_SANDBOX=false`)

### SSL/TLS

- [ ] ACM certificate issued and attached to ALB
- [ ] HTTP → HTTPS redirect enabled
- [ ] HSTS headers set (configure in api-gateway NestJS app)

---

## 14. Cost Estimation

Approximate monthly costs (us-east-1 pricing, adjust for your region):

| Resource | Specification | Est. Monthly Cost |
|----------|--------------|-------------------|
| EC2 (ECS) | 2x t3.xlarge (on-demand) | ~$240 |
| EC2 (Kafka) | 1x t3.medium (on-demand) | ~$30 |
| ALB | 1 ALB + LCUs | ~$25 |
| NAT Gateway | 1 gateway + data transfer | ~$35 |
| ECR | ~5 GB storage | ~$0.50 |
| Secrets Manager | 8 secrets | ~$3.20 |
| CloudWatch Logs | ~10 GB/month | ~$5 |
| CloudWatch Alarms | 5 alarms | ~$0.50 |
| SQS (FIFO) | Low volume | ~$0.50 |
| Route 53 | 1 hosted zone + queries | ~$1 |
| ACM | Free (for ALB-attached certs) | $0 |
| **Total** | | **~$340/month** |

### Cost Optimization Tips

- **Reserved Instances:** Save 30-60% on EC2 by committing to 1-year or 3-year terms
- **Spot Instances:** Use for non-critical services (email-service, audit-log-service) to save up to 70%
- **Single NAT Gateway:** Currently using 1 NAT GW. For HA, add a second in AZ2 (+$35/month)
- **Log retention:** Set CloudWatch log retention to 7-14 days if you don't need 30-day history

---

## 15. Troubleshooting

### Service Discovery DNS Resolution

**Symptom:** `api-gateway` cannot connect to gRPC services (e.g., `auth-service.brinex.local:50000`)

**Debug:**
```bash
# ECS Exec into the api-gateway container
aws ecs execute-command --cluster brinex-cluster \
  --task <TASK_ID> --container api-gateway \
  --interactive --command "/bin/sh"

# Inside the container, test DNS resolution
nslookup auth-service.brinex.local

# Test gRPC connectivity
node -e "require('net').connect(50000, 'auth-service.brinex.local', () => console.log('OK'))"
```

**Fixes:**
- Ensure Cloud Map namespace VPC matches the ECS VPC
- Check that the target service task is running and registered
- Verify security group allows inbound on the gRPC port from ECS SG

### Kafka Connectivity from ECS

**Symptom:** Services fail to produce/consume Kafka messages

**Debug:**
```bash
# From ECS container
node -e "require('net').connect(9092, '<KAFKA_PRIVATE_IP>', () => console.log('OK'))"

# From Kafka EC2 instance
/opt/kafka/bin/kafka-topics --bootstrap-server localhost:9092 --list
/opt/kafka/bin/kafka-consumer-groups --bootstrap-server localhost:9092 --list
```

**Fixes:**
- Ensure `KAFKA_BROKER` env var points to Kafka's private IP (not `kafka` hostname)
- Check Kafka security group allows inbound 9092 from ECS SG
- Verify `advertised.listeners` in Kafka config uses the private IP
- Restart Kafka if broker metadata is stale

### ONNX Model Loading Failures

**Symptom:** vision-service or crystallization-onnx-service crashes on startup

**Debug:**
```bash
# Check logs
aws logs tail /ecs/brinex/vision-service --follow

# Verify model is baked into the image
docker run --rm <IMAGE> ls -la /app/models/
```

**Fixes:**
- vision-service: model must be at `/app/models/best.onnx` (set `VISION_MODEL_PATH=/app/models/best.onnx`)
- crystallization-onnx-service: model must be at `/app/models/crystallization_model.onnx`
- Ensure the Docker images use the Debian slim base (not Alpine) — ONNX Runtime requires glibc
- Give sufficient memory: 2048 MB minimum for ML services

### WebSocket Timeout on ALB

**Symptom:** Socket.io connections drop after ~60 seconds

**Fix:**
```bash
# Increase ALB idle timeout (already in Section 9)
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn $ALB_ARN \
  --attributes Key=idle_timeout.timeout_seconds,Value=300
```

- Socket.io client should use `transports: ['websocket']` to avoid long-polling fallback
- Enable sticky sessions on the target group (already configured)

### Viewing Logs

```bash
# Real-time tail
aws logs tail /ecs/brinex/<service-name> --follow

# Search for errors in the last hour
aws logs filter-log-events \
  --log-group-name /ecs/brinex/<service-name> \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s000)

# View specific task logs
aws logs get-log-events \
  --log-group-name /ecs/brinex/<service-name> \
  --log-stream-name "ecs/<container-name>/<task-id>"
```

### ECS Exec (SSH into Containers)

```bash
# Enable ECS Exec on the service (one-time)
aws ecs update-service --cluster brinex-cluster \
  --service <service-name> --enable-execute-command

# Force new deployment to pick up the change
aws ecs update-service --cluster brinex-cluster \
  --service <service-name> --force-new-deployment

# Wait for new task, then exec in
TASK_ID=$(aws ecs list-tasks --cluster brinex-cluster \
  --service-name <service-name> --query 'taskArns[0]' --output text)

aws ecs execute-command --cluster brinex-cluster \
  --task $TASK_ID --container <container-name> \
  --interactive --command "/bin/sh"
```

### Common ECS Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Task stuck in PENDING | No EC2 capacity | Check ASG desired count, instance health |
| Task fails to start | Image pull error | Verify ECR login, image tag exists |
| Task starts then stops | App crash | Check CloudWatch logs for the container |
| Service not reachable | Wrong security group | Verify SG rules allow the required ports |
| High memory usage | OOM kill | Increase task memory in task definition |

---

## Verification Checklist

After completing deployment, verify each step:

1. **Docker images:** All 11 images built and pushed to ECR
   ```bash
   for REPO in brinex/standard brinex/vision brinex/onnx; do
     aws ecr list-images --repository-name $REPO --query 'imageIds[*].imageTag' --output table
   done
   ```

2. **ECS services running:** All 11 services in RUNNING state
   ```bash
   aws ecs list-services --cluster brinex-cluster --query 'serviceArns' --output table
   aws ecs describe-services --cluster brinex-cluster \
     --services api-gateway auth-service user-service \
     --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount}' --output table
   ```

3. **Cloud Map registration:** All services registered
   ```bash
   aws servicediscovery list-instances --service-id <SD_SERVICE_ID>
   ```

4. **ALB health check:** api-gateway is healthy
   ```bash
   aws elbv2 describe-target-health --target-group-arn $TG_ARN
   ```

5. **WebSocket test:**
   ```bash
   # Install wscat if needed: npm install -g wscat
   wscat -c "wss://api.yourdomain.com/vision"
   ```

6. **End-to-end flow:** Frontend → ALB → api-gateway → auth-service → MongoDB
   ```bash
   curl -X POST https://api.yourdomain.com/api/v1/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"phone": "+94771234567"}'
   ```

7. **Kafka integration:** Trigger an action and verify consumer processing
   ```bash
   # Check audit-log-service logs after making any API request
   aws logs tail /ecs/brinex/audit-log-service --follow
   ```

8. **Email service:** Trigger OTP and verify email delivery
   ```bash
   aws logs tail /ecs/brinex/email-service --follow
   ```
