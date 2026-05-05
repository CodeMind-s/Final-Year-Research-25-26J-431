# Brinex Backend — AWS ECS Deployment Guide (From Scratch)

This guide walks you through deploying the entire Brinex NestJS microservices stack to **AWS ECS (Elastic Container Service)** using **EC2 launch type** (self-managed EC2 instances). By the end, you'll have all 11 services running on AWS just like they run on Docker Desktop.

---

## Table of Contents

1. [Architecture Overview — What We're Building](#1-architecture-overview)
2. [Prerequisites — What You Need Before Starting](#2-prerequisites)
3. [Step 1: Install & Configure AWS CLI](#step-1-install--configure-aws-cli)
4. [Step 2: Create an ECR Repository for Each Service](#step-2-create-ecr-repositories)
5. [Step 3: Build & Push Docker Images to ECR](#step-3-build--push-docker-images)
6. [Step 4: Create a VPC (Virtual Private Cloud)](#step-4-create-a-vpc)
7. [Step 5: Create an ECS Cluster](#step-5-create-an-ecs-cluster)
8. [Step 6: Set Up AWS Secrets Manager / Parameter Store](#step-6-set-up-secrets)
9. [Step 7: Create IAM Roles for ECS Tasks](#step-7-create-iam-roles)
10. [Step 8: Set Up Amazon MSK (Managed Kafka)](#step-8-set-up-amazon-msk)
11. [Step 9: Create ECS Task Definitions](#step-9-create-task-definitions)
12. [Step 10: Create an Application Load Balancer (ALB)](#step-10-create-an-alb)
13. [Step 11: Create ECS Services](#step-11-create-ecs-services)
14. [Step 12: Set Up Service Discovery (Cloud Map)](#step-12-service-discovery)
15. [Step 13: Configure Security Groups](#step-13-configure-security-groups)
16. [Step 14: Set Up CI/CD with GitHub Actions](#step-14-cicd-with-github-actions)
17. [Step 15: Monitoring & Logging](#step-15-monitoring--logging)
18. [Step 16: Accessing Your API (No Domain Required)](#step-16-accessing-your-api)
19. [Cost Estimation](#cost-estimation)
20. [Troubleshooting](#troubleshooting)

---

## 1. Architecture Overview

### What changes from Docker Desktop to AWS ECS

| Component | Docker Desktop (Local) | AWS ECS (Production) |
|-----------|----------------------|---------------------|
| Container runtime | Docker Engine | EC2 instances with ECS Agent |
| Container registry | Local images | Amazon ECR |
| Networking | `app-network` (bridge) | AWS VPC + Security Groups |
| Service discovery | Container names (e.g., `kafka:9092`) | AWS Cloud Map (e.g., `kafka.brinex.local`) |
| Load balancing | Direct port mapping | Application Load Balancer (ALB) |
| Kafka | Self-hosted container | Amazon MSK (Managed Streaming for Kafka) |
| Secrets | `.env` file | AWS Secrets Manager / SSM Parameter Store |
| Logging | `docker logs` | Amazon CloudWatch Logs |
| SSL/HTTPS | ngrok tunnel | ALB HTTP (HTTPS optional later when you get a domain) |
| MongoDB | MongoDB Atlas (unchanged) | MongoDB Atlas (unchanged — no change needed) |

### Target Architecture Diagram

```
Internet
    |
    v
[Application Load Balancer (ALB)]  :80 (HTTP)
  (ALB DNS: brinex-alb-xxxx.ap-south-1.elb.amazonaws.com)
    |
    v (port 3400)
[ECS Service: api-gateway]
    |
    | gRPC (internal, via Cloud Map DNS)
    +---> auth-service.brinex.local:50000
    +---> user-service.brinex.local:50053
    +---> crystallization-service.brinex.local:50054
    +---> vision-service.brinex.local:50057
    +---> payment-service.brinex.local:50056
    +---> compass-service.brinex.local:50052
    +---> waste-valorization-service.brinex.local:50058
    |
    | gRPC (internal)
    +---> crystallization-onnx-service.brinex.local:50055
    |
    | Kafka (internal)
    +---> Amazon MSK broker:9092
           +---> email-service (consumer)
           +---> audit-log-service (consumer)
    |
    v
[MongoDB Atlas] (external, unchanged)
```

---

## 2. Prerequisites

Before you begin, make sure you have:

- [ ] **AWS Account** — Sign up at https://aws.amazon.com if you don't have one
- [ ] **AWS CLI v2** — We'll install this in Step 1
- [ ] **Docker Desktop** — Already running (you have this)
- [ ] **Git** — Your code is version-controlled
- [ ] **A credit/debit card** on your AWS account (required for resource creation)
- [ ] **Your `.env` file** — All the environment variables currently in your `.env`
- [ ] **No domain required** — You'll access the API via the ALB's auto-generated DNS name

### Estimated AWS Costs

> Running all 11 services on EC2 will cost approximately **$80–150/month** depending on instance sizing. Much cheaper than Fargate. See the [Cost Estimation](#cost-estimation) section for a breakdown.

---

## Step 1: Install & Configure AWS CLI

### 1.1 Install AWS CLI v2

**Windows:**
Download and run the MSI installer:
```powershell
# Download from: https://awscli.amazonaws.com/AWSCLIV2.msi
# Or via winget:
winget install Amazon.AWSCLI
```

Verify installation:
```bash
aws --version
# Should output: aws-cli/2.x.x ...
```

### 1.2 Create an IAM User for CLI Access

1. Go to **AWS Console** → **IAM** → **Users** → **Create User**
2. Username: `brinex-deployer`
3. Select **"Attach policies directly"**
4. Attach these policies:
   - `AmazonECS_FullAccess`
   - `AmazonEC2ContainerRegistryFullAccess`
   - `AmazonVPCFullAccess`
   - `ElasticLoadBalancingFullAccess`
   - `AmazonSSMFullAccess`
   - `SecretsManagerReadWrite`
   - `CloudWatchFullAccess`
   - `AmazonMSKFullAccess`
   - `AWSCloudMapFullAccess`
   - `IAMFullAccess` (needed to create ECS task roles)
5. Click **Create User**
6. Go to the user → **Security credentials** → **Create access key**
7. Choose **"Command Line Interface (CLI)"** → Create
8. **Save the Access Key ID and Secret Access Key** (you won't see the secret again)

### 1.3 Configure AWS CLI

```bash
aws configure
```

Enter when prompted:
```
AWS Access Key ID: <your-access-key-id>
AWS Secret Access Key: <your-secret-access-key>
Default region name: ap-south-1          # Choose your nearest region (Mumbai for Sri Lanka)
Default output format: json
```

Verify it works:
```bash
aws sts get-caller-identity
# Should show your account ID and IAM user
```

> **Region selection tip:** Since Brinex targets the salt industry in Sri Lanka, `ap-south-1` (Mumbai) is the closest AWS region with full ECS/MSK support.

---

## Step 2: Create ECR Repositories

**Amazon ECR (Elastic Container Registry)** is where your Docker images will be stored — like Docker Hub but private and integrated with ECS.

### 2.1 Create one repository per service

You need a repository for each of your 12 services. Run these commands:

```bash
# Set your preferred region
export AWS_REGION=ap-south-1

# Create ECR repositories for all services
for service in \
  api-gateway \
  auth-service \
  user-service \
  crystallization-service \
  crystallization-onnx-service \
  vision-service \
  payment-service \
  compass-service \
  waste-valorization-service \
  email-service \
  audit-log-service; do

  aws ecr create-repository \
    --repository-name brinex/${service} \
    --region ${AWS_REGION} \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256

  echo "Created repository: brinex/${service}"
done
```

### 2.2 Verify repositories were created

```bash
aws ecr describe-repositories --region ${AWS_REGION} \
  --query 'repositories[*].repositoryName' --output table
```

### 2.3 Get your ECR login URI

```bash
# Get your AWS Account ID
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_URI=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

echo "Your ECR URI: ${ECR_URI}"
# Example output: 123456789012.dkr.ecr.ap-south-1.amazonaws.com
```

**Save this URI** — you'll use it throughout the deployment.

---

## Step 3: Build & Push Docker Images

### 3.1 Authenticate Docker to ECR

```bash
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${ECR_URI}
```

You should see: `Login Succeeded`

### 3.2 Build and push each service image

Navigate to your backend repo:
```bash
cd /c/Development/python/brinex/Final-Year-Research-25-26J-431
```

**Build and push services using the shared Dockerfile (with `SERVICE_NAME` arg):**

```bash
# Services that use the shared root Dockerfile
for service in \
  api-gateway \
  auth-service \
  user-service \
  crystallization-service \
  payment-service \
  compass-service \
  waste-valorization-service \
  email-service \
  audit-log-service; do

  echo "========================================="
  echo "Building and pushing: ${service}"
  echo "========================================="

  # Build the image
  docker build \
    --build-arg SERVICE_NAME=${service} \
    -t brinex/${service}:latest \
    -t ${ECR_URI}/brinex/${service}:latest \
    -f Dockerfile .

  # Push to ECR
  docker push ${ECR_URI}/brinex/${service}:latest

  echo "Pushed: ${service}"
done
```

**Build and push services with custom Dockerfiles:**

```bash
# crystallization-onnx-service (custom Dockerfile, uses node:20-slim for glibc)
docker build \
  -t brinex/crystallization-onnx-service:latest \
  -t ${ECR_URI}/brinex/crystallization-onnx-service:latest \
  -f apps/crystallization-onnx-service/Dockerfile .

docker push ${ECR_URI}/brinex/crystallization-onnx-service:latest

# vision-service (custom Dockerfile, uses node:20-slim for glibc + sharp)
docker build \
  -t brinex/vision-service:latest \
  -t ${ECR_URI}/brinex/vision-service:latest \
  -f apps/vision-service/Dockerfile .

docker push ${ECR_URI}/brinex/vision-service:latest
```

### 3.3 Verify images are in ECR

```bash
aws ecr list-images --repository-name brinex/api-gateway --region ${AWS_REGION}
```

> **Tip:** Each `docker build` can take 3–10 minutes. The first build is slow, subsequent builds use Docker layer caching and are much faster.

---

## Step 4: Create a VPC

A **VPC (Virtual Private Cloud)** is your isolated network on AWS. All your ECS services will run inside it.

### 4.1 Create VPC using AWS CLI

We'll create a VPC with public subnets (for EC2 instances + ALB) and private subnets (for MSK Kafka) across 2 Availability Zones:

```bash
# Create the VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=brinex-vpc}]' \
  --query 'Vpc.VpcId' --output text)

echo "VPC ID: ${VPC_ID}"

# Enable DNS hostnames (required for service discovery)
aws ec2 modify-vpc-attribute --vpc-id ${VPC_ID} --enable-dns-hostnames '{"Value": true}'
aws ec2 modify-vpc-attribute --vpc-id ${VPC_ID} --enable-dns-support '{"Value": true}'
```

### 4.2 Create Subnets

```bash
# Get available Availability Zones
AZ1=$(aws ec2 describe-availability-zones --region ${AWS_REGION} \
  --query 'AvailabilityZones[0].ZoneName' --output text)
AZ2=$(aws ec2 describe-availability-zones --region ${AWS_REGION} \
  --query 'AvailabilityZones[1].ZoneName' --output text)

echo "Using AZs: ${AZ1}, ${AZ2}"

# Public subnet 1 (for ALB)
PUBLIC_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id ${VPC_ID} \
  --cidr-block 10.0.1.0/24 \
  --availability-zone ${AZ1} \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=brinex-public-1}]' \
  --query 'Subnet.SubnetId' --output text)

# Public subnet 2 (for ALB — ALB requires 2 AZs)
PUBLIC_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id ${VPC_ID} \
  --cidr-block 10.0.2.0/24 \
  --availability-zone ${AZ2} \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=brinex-public-2}]' \
  --query 'Subnet.SubnetId' --output text)

# Private subnet 1 (for ECS tasks)
PRIVATE_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id ${VPC_ID} \
  --cidr-block 10.0.3.0/24 \
  --availability-zone ${AZ1} \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=brinex-private-1}]' \
  --query 'Subnet.SubnetId' --output text)

# Private subnet 2 (for ECS tasks)
PRIVATE_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id ${VPC_ID} \
  --cidr-block 10.0.4.0/24 \
  --availability-zone ${AZ2} \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=brinex-private-2}]' \
  --query 'Subnet.SubnetId' --output text)

echo "Public Subnets:  ${PUBLIC_SUBNET_1}, ${PUBLIC_SUBNET_2}"
echo "Private Subnets: ${PRIVATE_SUBNET_1}, ${PRIVATE_SUBNET_2}"
```

### 4.3 Create Internet Gateway (for public subnets)

```bash
# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=brinex-igw}]' \
  --query 'InternetGateway.InternetGatewayId' --output text)

# Attach to VPC
aws ec2 attach-internet-gateway --internet-gateway-id ${IGW_ID} --vpc-id ${VPC_ID}

# Create public route table
PUBLIC_RT=$(aws ec2 create-route-table \
  --vpc-id ${VPC_ID} \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=brinex-public-rt}]' \
  --query 'RouteTable.RouteTableId' --output text)

# Add route to Internet
aws ec2 create-route --route-table-id ${PUBLIC_RT} \
  --destination-cidr-block 0.0.0.0/0 --gateway-id ${IGW_ID}

# Associate public subnets with public route table
aws ec2 associate-route-table --route-table-id ${PUBLIC_RT} --subnet-id ${PUBLIC_SUBNET_1}
aws ec2 associate-route-table --route-table-id ${PUBLIC_RT} --subnet-id ${PUBLIC_SUBNET_2}

# Enable auto-assign public IPs on public subnets
aws ec2 modify-subnet-attribute --subnet-id ${PUBLIC_SUBNET_1} --map-public-ip-on-launch
aws ec2 modify-subnet-attribute --subnet-id ${PUBLIC_SUBNET_2} --map-public-ip-on-launch
```

### 4.4 NAT Gateway — NOT NEEDED

Since we're running EC2 instances in **public subnets** (they get public IPs via the Internet Gateway), we **don't need a NAT Gateway**. This saves ~$35/month.

> **Note:** If you later want to move EC2 instances to private subnets for better security, you'd need to add a NAT Gateway. For now, public subnets with Security Groups provide sufficient protection.

---

## Step 5: Create an ECS Cluster with EC2 Instances

An **ECS Cluster** is a logical grouping of your services. With EC2 launch type, you manage the underlying instances yourself — but it's significantly cheaper than Fargate.

### 5.1 Create the ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name brinex-cluster \
  --configuration '{
    "executeCommandConfiguration": {
      "logging": "DEFAULT"
    }
  }' \
  --settings '[{"name":"containerInsights","value":"enabled"}]'

echo "ECS Cluster 'brinex-cluster' created!"
```

### 5.2 Create an EC2 Instance Role for ECS

EC2 instances need an IAM role so the **ECS Agent** running on them can communicate with ECS, pull images from ECR, etc.

```bash
# Create trust policy for EC2
cat > /tmp/ec2-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name brinex-ecs-instance-role \
  --assume-role-policy-document file:///tmp/ec2-trust-policy.json

# Attach the ECS-managed policy (lets ECS Agent work)
aws iam attach-role-policy \
  --role-name brinex-ecs-instance-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role

# Attach SSM policy (lets you SSH into instances via Session Manager)
aws iam attach-role-policy \
  --role-name brinex-ecs-instance-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

# Create an instance profile (required to attach the role to EC2)
aws iam create-instance-profile \
  --instance-profile-name brinex-ecs-instance-profile

aws iam add-role-to-instance-profile \
  --instance-profile-name brinex-ecs-instance-profile \
  --role-name brinex-ecs-instance-role

echo "EC2 Instance Role & Profile created!"
# Wait a few seconds for IAM to propagate
sleep 10
```

### 5.3 Create a Security Group for EC2 Instances

```bash
EC2_SG=$(aws ec2 create-security-group \
  --group-name brinex-ec2-sg \
  --description "Security group for Brinex ECS EC2 instances" \
  --vpc-id ${VPC_ID} \
  --query 'GroupId' --output text)

# Allow all traffic between EC2 instances (for gRPC inter-service communication)
aws ec2 authorize-security-group-ingress --group-id ${EC2_SG} \
  --protocol tcp --port 0-65535 --source-group ${EC2_SG}

# Allow SSH from your IP (optional, for debugging)
# aws ec2 authorize-security-group-ingress --group-id ${EC2_SG} \
#   --protocol tcp --port 22 --cidr YOUR_IP/32

echo "EC2 Security Group: ${EC2_SG}"
```

### 5.4 Create a Launch Template

A Launch Template defines what kind of EC2 instances to spin up.

```bash
# Get the latest ECS-optimized Amazon Linux 2023 AMI
ECS_AMI=$(aws ssm get-parameters \
  --names /aws/service/ecs/optimized-ami/amazon-linux-2023/recommended/image_id \
  --query 'Parameters[0].Value' --output text)

echo "ECS-optimized AMI: ${ECS_AMI}"

# Create the launch template
# User data script tells the instance which ECS cluster to join
USER_DATA=$(cat <<'USERDATA' | base64 -w 0
#!/bin/bash
cat <<'EOF' >> /etc/ecs/ecs.config
ECS_CLUSTER=brinex-cluster
ECS_ENABLE_TASK_IAM_ROLE=true
ECS_ENABLE_TASK_ENI=true
ECS_AWSVPC_BLOCK_IMDS=true
EOF
USERDATA
)

aws ec2 create-launch-template \
  --launch-template-name brinex-ecs-template \
  --launch-template-data '{
    "ImageId": "'"${ECS_AMI}"'",
    "InstanceType": "t3.xlarge",
    "IamInstanceProfile": {
      "Name": "brinex-ecs-instance-profile"
    },
    "SecurityGroupIds": ["'"${EC2_SG}"'"],
    "UserData": "'"${USER_DATA}"'",
    "BlockDeviceMappings": [
      {
        "DeviceName": "/dev/xvda",
        "Ebs": {
          "VolumeSize": 50,
          "VolumeType": "gp3",
          "Encrypted": true
        }
      }
    ],
    "TagSpecifications": [
      {
        "ResourceType": "instance",
        "Tags": [{"Key": "Name", "Value": "brinex-ecs-instance"}]
      }
    ]
  }'

echo "Launch Template created!"
```

### 5.5 Why t3.xlarge?

Your 11 services need approximately **4 vCPU** and **8 GB RAM** total:

| Instance Type | vCPU | Memory | On-Demand Price (ap-south-1) | Fits all services? |
|---------------|------|--------|------------------------------|-------------------|
| t3.large | 2 | 8 GB | ~$0.0832/hr (~$60/mo) | Tight — need 2 instances |
| **t3.xlarge** | **4** | **16 GB** | **~$0.1664/hr (~$120/mo)** | **Yes — 1 instance fits all** |
| t3.2xlarge | 8 | 32 GB | ~$0.3328/hr (~$240/mo) | Overkill |

> **Recommended:** Start with **1x t3.xlarge** for development/testing. Add a second instance later for high availability.

### 5.6 Create an Auto Scaling Group

```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name brinex-ecs-asg \
  --launch-template LaunchTemplateName=brinex-ecs-template,Version='$Latest' \
  --min-size 1 \
  --max-size 3 \
  --desired-capacity 1 \
  --vpc-zone-identifier "${PUBLIC_SUBNET_1},${PUBLIC_SUBNET_2}" \
  --health-check-type EC2 \
  --health-check-grace-period 300 \
  --tags Key=Name,Value=brinex-ecs-instance,PropagateAtLaunch=true

echo "Auto Scaling Group created with 1 instance!"
```

### 5.7 Register the ASG as an ECS Capacity Provider

This tells ECS to use your EC2 instances for running containers.

```bash
# Create capacity provider linked to the ASG
aws ecs create-capacity-provider \
  --name brinex-ec2-capacity \
  --auto-scaling-group-provider '{
    "autoScalingGroupArn": "'"$(aws autoscaling describe-auto-scaling-groups \
      --auto-scaling-group-names brinex-ecs-asg \
      --query 'AutoScalingGroups[0].AutoScalingGroupARN' --output text)"'",
    "managedScaling": {
      "status": "ENABLED",
      "targetCapacity": 80,
      "minimumScalingStepSize": 1,
      "maximumScalingStepSize": 1
    },
    "managedTerminationProtection": "DISABLED"
  }'

# Attach the capacity provider to the cluster
aws ecs put-cluster-capacity-providers \
  --cluster brinex-cluster \
  --capacity-providers brinex-ec2-capacity \
  --default-capacity-provider-strategy capacityProvider=brinex-ec2-capacity,weight=1,base=1

echo "Capacity Provider registered!"
```

### 5.8 Verify Instance Joined the Cluster

Wait ~2 minutes for the instance to boot, then check:

```bash
aws ecs list-container-instances --cluster brinex-cluster
# Should show 1 container instance ARN

# See instance details
aws ecs describe-container-instances --cluster brinex-cluster \
  --container-instances $(aws ecs list-container-instances \
    --cluster brinex-cluster --query 'containerInstanceArns[0]' --output text) \
  --query 'containerInstances[0].{cpu:remainingResources[?name==`CPU`].integerValue,memory:remainingResources[?name==`MEMORY`].integerValue,status:status}'
```

You should see the instance with ~4096 CPU units and ~15000+ MB memory available.

---

## Step 6: Set Up Secrets

Your `.env` file contains sensitive values (database credentials, API keys, JWT secrets). **Never hardcode these in task definitions.**

### 6.1 Store secrets in AWS Secrets Manager

```bash
# Store each secret individually for fine-grained access
# Pricing: $0.40/secret/month + $0.05 per 10,000 API calls

aws secretsmanager create-secret \
  --name brinex/mongo-uri \
  --description "MongoDB Atlas connection string" \
  --secret-string "mongodb+srv://YOUR_USER:YOUR_PASS@cluster.mongodb.net/brinex"

aws secretsmanager create-secret \
  --name brinex/jwt-secret \
  --description "JWT signing secret" \
  --secret-string "YOUR_JWT_SECRET"

aws secretsmanager create-secret \
  --name brinex/notify-lk-user-id \
  --secret-string "YOUR_NOTIFY_LK_USER_ID"

aws secretsmanager create-secret \
  --name brinex/notify-lk-api-key \
  --secret-string "YOUR_NOTIFY_LK_API_KEY"

aws secretsmanager create-secret \
  --name brinex/notify-lk-sender-id \
  --secret-string "YOUR_NOTIFY_LK_SENDER_ID"

aws secretsmanager create-secret \
  --name brinex/openweather-api-key \
  --secret-string "YOUR_OPENWEATHER_KEY"

aws secretsmanager create-secret \
  --name brinex/email-host \
  --secret-string "smtp.gmail.com"

aws secretsmanager create-secret \
  --name brinex/email-port \
  --secret-string "587"

aws secretsmanager create-secret \
  --name brinex/email-user \
  --secret-string "YOUR_EMAIL"

aws secretsmanager create-secret \
  --name brinex/email-password \
  --secret-string "YOUR_EMAIL_APP_PASSWORD"

aws secretsmanager create-secret \
  --name brinex/email-from \
  --secret-string "BrineX <noreply@brinex.com>"

aws secretsmanager create-secret \
  --name brinex/payhere-merchant-id \
  --secret-string "YOUR_MERCHANT_ID"

aws secretsmanager create-secret \
  --name brinex/payhere-merchant-secret \
  --secret-string "YOUR_MERCHANT_SECRET"
```

### 6.2 Store non-sensitive config in SSM Parameter Store (free)

```bash
# SSM Parameter Store is free for standard parameters
aws ssm put-parameter \
  --name /brinex/openweather-lat \
  --value "8.061542" \
  --type String

aws ssm put-parameter \
  --name /brinex/openweather-lon \
  --value "79.814714" \
  --type String

aws ssm put-parameter \
  --name /brinex/payhere-sandbox \
  --value "false" \
  --type String

aws ssm put-parameter \
  --name /brinex/frontend-url \
  --value "http://localhost:3000" \
  --type String
# ^ Update this later to your frontend's actual URL (Vercel, Amplify, etc.)
# Since you don't have a domain, use the frontend dev URL or hosting URL
```

---

## Step 7: Create IAM Roles

ECS tasks need IAM roles to access ECR, Secrets Manager, CloudWatch, etc.

### 7.1 Create the ECS Task Execution Role

This role allows ECS **to pull images and inject secrets** into your containers:

```bash
# Create the trust policy document
cat > /tmp/ecs-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name brinex-ecs-execution-role \
  --assume-role-policy-document file:///tmp/ecs-trust-policy.json

# Attach the managed ECS execution policy
aws iam attach-role-policy \
  --role-name brinex-ecs-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Create custom policy for Secrets Manager access
cat > /tmp/secrets-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:brinex/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/brinex/*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name brinex-ecs-execution-role \
  --policy-name brinex-secrets-access \
  --policy-document file:///tmp/secrets-policy.json
```

### 7.2 Create the ECS Task Role

This role is for **your application code** to access AWS services (S3, SQS, etc.):

```bash
aws iam create-role \
  --role-name brinex-ecs-task-role \
  --assume-role-policy-document file:///tmp/ecs-trust-policy.json

# Add S3 access (for waste-valorization-service)
aws iam attach-role-policy \
  --role-name brinex-ecs-task-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# Add SQS access (for waste-valorization-service)
aws iam attach-role-policy \
  --role-name brinex-ecs-task-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSQSFullAccess

# Add ECS Exec access (for debugging — lets you SSH into containers)
cat > /tmp/ecs-exec-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name brinex-ecs-task-role \
  --policy-name brinex-ecs-exec \
  --policy-document file:///tmp/ecs-exec-policy.json
```

---

## Step 8: Set Up Amazon MSK (Managed Kafka)

Your services use Kafka for async messaging (email, audit-log). **Amazon MSK** is the managed Kafka equivalent.

### 8.1 Create a Security Group for MSK

```bash
MSK_SG=$(aws ec2 create-security-group \
  --group-name brinex-msk-sg \
  --description "Security group for Brinex MSK Kafka" \
  --vpc-id ${VPC_ID} \
  --query 'GroupId' --output text)

# Allow Kafka traffic from the VPC
aws ec2 authorize-security-group-ingress \
  --group-id ${MSK_SG} \
  --protocol tcp --port 9092 \
  --cidr 10.0.0.0/16

echo "MSK Security Group: ${MSK_SG}"
```

### 8.2 Create MSK Cluster

```bash
cat > /tmp/msk-config.json << EOF
{
  "ClusterName": "brinex-kafka",
  "KafkaVersion": "3.5.1",
  "NumberOfBrokerNodes": 2,
  "BrokerNodeGroupInfo": {
    "InstanceType": "kafka.t3.small",
    "ClientSubnets": ["${PRIVATE_SUBNET_1}", "${PRIVATE_SUBNET_2}"],
    "SecurityGroups": ["${MSK_SG}"],
    "StorageInfo": {
      "EbsStorageInfo": {
        "VolumeSize": 10
      }
    }
  },
  "EncryptionInfo": {
    "EncryptionInTransit": {
      "ClientBroker": "PLAINTEXT",
      "InCluster": true
    }
  }
}
EOF

MSK_CLUSTER_ARN=$(aws kafka create-cluster \
  --cli-input-json file:///tmp/msk-config.json \
  --query 'ClusterArn' --output text)

echo "MSK Cluster ARN: ${MSK_CLUSTER_ARN}"
echo "MSK cluster creation takes 15-20 minutes..."
```

### 8.3 Get MSK Bootstrap Brokers (after cluster is ACTIVE)

```bash
# Wait until the cluster state is ACTIVE
aws kafka describe-cluster --cluster-arn ${MSK_CLUSTER_ARN} \
  --query 'ClusterInfo.State' --output text

# Once ACTIVE, get the bootstrap brokers
KAFKA_BROKERS=$(aws kafka get-bootstrap-brokers \
  --cluster-arn ${MSK_CLUSTER_ARN} \
  --query 'BootstrapBrokerString' --output text)

echo "Kafka Brokers: ${KAFKA_BROKERS}"
# Example: b-1.brinex-kafka.xxx.kafka.ap-south-1.amazonaws.com:9092,b-2...
```

**Save this broker string** — you'll use it in task definitions as `KAFKA_BROKER`.

### Alternative: Use a self-managed Kafka on ECS

If MSK is too expensive for your use case (~$60/month minimum), you can run Kafka as an ECS service just like you do locally. See [Appendix A](#appendix-a-self-managed-kafka-on-ecs) at the bottom.

---

## Step 9: Create ECS Task Definitions

A **Task Definition** is like a `docker-compose` service definition — it tells ECS what image to run, how much CPU/memory, environment variables, etc.

### 9.1 Understanding Resource Sizing

| Service | CPU | Memory | Notes |
|---------|-----|--------|-------|
| api-gateway | 512 (0.5 vCPU) | 1024 MB | Handles all HTTP traffic |
| auth-service | 256 (0.25 vCPU) | 512 MB | Lightweight gRPC |
| user-service | 256 | 512 MB | Lightweight gRPC |
| crystallization-service | 256 | 512 MB | |
| crystallization-onnx-service | 512 | 1024 MB | ML inference needs more memory |
| vision-service | 1024 (1 vCPU) | 2048 MB | YOLOv8 + Sharp image processing |
| payment-service | 256 | 512 MB | |
| compass-service | 256 | 512 MB | |
| waste-valorization-service | 256 | 512 MB | |
| email-service | 256 | 512 MB | Kafka consumer |
| audit-log-service | 256 | 512 MB | Kafka consumer |

### 9.2 Create the API Gateway Task Definition

This is the most complex one since it's your entry point. We'll show this in full, then provide a pattern for the rest.

```bash
# Get the execution role ARN
EXEC_ROLE_ARN=$(aws iam get-role --role-name brinex-ecs-execution-role \
  --query 'Role.Arn' --output text)
TASK_ROLE_ARN=$(aws iam get-role --role-name brinex-ecs-task-role \
  --query 'Role.Arn' --output text)

cat > /tmp/api-gateway-task.json << EOF
{
  "family": "brinex-api-gateway",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "api-gateway",
      "image": "${ECR_URI}/brinex/api-gateway:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3400,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "PORT", "value": "3400"},
        {"name": "AUTH_SERVICE_URL", "value": "auth-service.brinex.local:50000"},
        {"name": "USER_SERVICE_URL", "value": "user-service.brinex.local:50053"},
        {"name": "CRYSTALLIZATION_SERVICE_URL", "value": "crystallization-service.brinex.local:50054"},
        {"name": "VISION_SERVICE_URL", "value": "vision-service.brinex.local:50057"},
        {"name": "PAYMENT_SERVICE_URL", "value": "payment-service.brinex.local:50056"},
        {"name": "COMPASS_SERVICE_URL", "value": "compass-service.brinex.local:50052"},
        {"name": "WASTE_VALORIZATION_SERVICE_URL", "value": "waste-valorization-service.brinex.local:50058"},
        {"name": "KAFKA_BROKER", "value": "${KAFKA_BROKERS}"}
      ],
      "secrets": [
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/api-gateway",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3400/api/v1', (r) => process.exit(r.statusCode === 200 ? 0 : 1))\" || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

aws ecs register-task-definition \
  --cli-input-json file:///tmp/api-gateway-task.json

echo "Task definition registered: brinex-api-gateway"
```

### 9.3 Create Task Definitions for All Other Services

Here is a reusable script to create task definitions for all gRPC services:

```bash
# --- auth-service ---
cat > /tmp/auth-service-task.json << EOF
{
  "family": "brinex-auth-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "auth-service",
      "image": "${ECR_URI}/brinex/auth-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 50000, "protocol": "tcp"}],
      "environment": [
        {"name": "GRPC_URL", "value": "0.0.0.0:50000"},
        {"name": "KAFKA_BROKER", "value": "${KAFKA_BROKERS}"}
      ],
      "secrets": [
        {"name": "MONGO_URI", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/mongo-uri"},
        {"name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/jwt-secret"},
        {"name": "NOTIFY_LK_USER_ID", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/notify-lk-user-id"},
        {"name": "NOTIFY_LK_API_KEY", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/notify-lk-api-key"},
        {"name": "NOTIFY_LK_SENDER_ID", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/notify-lk-sender-id"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/auth-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF
aws ecs register-task-definition --cli-input-json file:///tmp/auth-service-task.json

# --- user-service ---
cat > /tmp/user-service-task.json << EOF
{
  "family": "brinex-user-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "user-service",
      "image": "${ECR_URI}/brinex/user-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 50053, "protocol": "tcp"}],
      "environment": [
        {"name": "GRPC_URL", "value": "0.0.0.0:50053"},
        {"name": "KAFKA_BROKER", "value": "${KAFKA_BROKERS}"}
      ],
      "secrets": [
        {"name": "MONGO_URI", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/mongo-uri"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/user-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF
aws ecs register-task-definition --cli-input-json file:///tmp/user-service-task.json

# --- crystallization-service ---
cat > /tmp/crystallization-service-task.json << EOF
{
  "family": "brinex-crystallization-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "crystallization-service",
      "image": "${ECR_URI}/brinex/crystallization-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 50054, "protocol": "tcp"}],
      "environment": [
        {"name": "GRPC_URL", "value": "0.0.0.0:50054"},
        {"name": "KAFKA_BROKER", "value": "${KAFKA_BROKERS}"},
        {"name": "ONNX_SERVICE_GRPC_URL", "value": "crystallization-onnx-service.brinex.local:50055"},
        {"name": "OPENWEATHER_LAT", "value": "8.061542"},
        {"name": "OPENWEATHER_LON", "value": "79.814714"}
      ],
      "secrets": [
        {"name": "MONGO_URI", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/mongo-uri"},
        {"name": "OPENWEATHER_API_KEY", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/openweather-api-key"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/crystallization-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF
aws ecs register-task-definition --cli-input-json file:///tmp/crystallization-service-task.json

# --- crystallization-onnx-service ---
cat > /tmp/crystallization-onnx-service-task.json << EOF
{
  "family": "brinex-crystallization-onnx-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "crystallization-onnx-service",
      "image": "${ECR_URI}/brinex/crystallization-onnx-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 50055, "protocol": "tcp"}],
      "environment": [
        {"name": "GRPC_URL", "value": "0.0.0.0:50055"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/crystallization-onnx-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF
aws ecs register-task-definition --cli-input-json file:///tmp/crystallization-onnx-service-task.json

# --- vision-service ---
cat > /tmp/vision-service-task.json << EOF
{
  "family": "brinex-vision-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "vision-service",
      "image": "${ECR_URI}/brinex/vision-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 50057, "protocol": "tcp"}],
      "environment": [
        {"name": "GRPC_URL", "value": "0.0.0.0:50057"},
        {"name": "VISION_MODEL_PATH", "value": "/app/models/best.onnx"}
      ],
      "secrets": [
        {"name": "MONGO_URI", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/mongo-uri"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/vision-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF
aws ecs register-task-definition --cli-input-json file:///tmp/vision-service-task.json

# --- payment-service ---
cat > /tmp/payment-service-task.json << EOF
{
  "family": "brinex-payment-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "payment-service",
      "image": "${ECR_URI}/brinex/payment-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 50056, "protocol": "tcp"}],
      "environment": [
        {"name": "GRPC_URL", "value": "0.0.0.0:50056"},
        {"name": "AUTH_SERVICE_URL", "value": "auth-service.brinex.local:50000"},
        {"name": "PAYHERE_SANDBOX", "value": "false"},
        {"name": "FRONTEND_URL", "value": "http://localhost:3000"}
      ],
      "secrets": [
        {"name": "MONGO_URI", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/mongo-uri"},
        {"name": "PAYHERE_MERCHANT_ID", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/payhere-merchant-id"},
        {"name": "PAYHERE_MERCHANT_SECRET", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/payhere-merchant-secret"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/payment-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF
aws ecs register-task-definition --cli-input-json file:///tmp/payment-service-task.json

# --- compass-service ---
cat > /tmp/compass-service-task.json << EOF
{
  "family": "brinex-compass-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "compass-service",
      "image": "${ECR_URI}/brinex/compass-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 50052, "protocol": "tcp"}],
      "environment": [
        {"name": "GRPC_URL", "value": "0.0.0.0:50052"},
        {"name": "KAFKA_BROKER", "value": "${KAFKA_BROKERS}"}
      ],
      "secrets": [
        {"name": "MONGO_URI", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/mongo-uri"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/compass-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF
aws ecs register-task-definition --cli-input-json file:///tmp/compass-service-task.json

# --- waste-valorization-service ---
cat > /tmp/waste-valorization-service-task.json << EOF
{
  "family": "brinex-waste-valorization-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "waste-valorization-service",
      "image": "${ECR_URI}/brinex/waste-valorization-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 50058, "protocol": "tcp"}],
      "environment": [
        {"name": "GRPC_URL", "value": "0.0.0.0:50058"},
        {"name": "KAFKA_BROKER", "value": "${KAFKA_BROKERS}"},
        {"name": "ENVIRONMENT", "value": "production"}
      ],
      "secrets": [
        {"name": "MONGO_URI", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/mongo-uri"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/waste-valorization-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF
aws ecs register-task-definition --cli-input-json file:///tmp/waste-valorization-service-task.json

# --- email-service (Kafka consumer, no port) ---
cat > /tmp/email-service-task.json << EOF
{
  "family": "brinex-email-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "email-service",
      "image": "${ECR_URI}/brinex/email-service:latest",
      "essential": true,
      "environment": [
        {"name": "KAFKA_BROKER", "value": "${KAFKA_BROKERS}"}
      ],
      "secrets": [
        {"name": "EMAIL_HOST", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/email-host"},
        {"name": "EMAIL_PORT", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/email-port"},
        {"name": "EMAIL_USER", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/email-user"},
        {"name": "EMAIL_PASSWORD", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/email-password"},
        {"name": "EMAIL_FROM", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/email-from"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/email-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF
aws ecs register-task-definition --cli-input-json file:///tmp/email-service-task.json

# --- audit-log-service (Kafka consumer, no port) ---
cat > /tmp/audit-log-service-task.json << EOF
{
  "family": "brinex-audit-log-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "audit-log-service",
      "image": "${ECR_URI}/brinex/audit-log-service:latest",
      "essential": true,
      "environment": [
        {"name": "KAFKA_BROKER", "value": "${KAFKA_BROKERS}"}
      ],
      "secrets": [
        {"name": "MONGO_URI", "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:brinex/mongo-uri"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/audit-log-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF
aws ecs register-task-definition --cli-input-json file:///tmp/audit-log-service-task.json

echo "All task definitions registered!"
```

---

## Step 10: Create an Application Load Balancer (ALB)

The ALB is the public entry point — it replaces `localhost:3400` and the ngrok tunnel.

### 10.1 Create Security Groups

```bash
# ALB Security Group — allows HTTP/HTTPS from the Internet
ALB_SG=$(aws ec2 create-security-group \
  --group-name brinex-alb-sg \
  --description "Security group for Brinex ALB" \
  --vpc-id ${VPC_ID} \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id ${ALB_SG} \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

echo "ALB Security Group: ${ALB_SG}"

# Allow ALB to reach EC2 instances on port 3400 (API Gateway)
aws ec2 authorize-security-group-ingress --group-id ${EC2_SG} \
  --protocol tcp --port 3400 --source-group ${ALB_SG}

echo "ALB → EC2 rule added to EC2 Security Group: ${EC2_SG}"
```

### 10.2 Create the ALB

```bash
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name brinex-alb \
  --type application \
  --scheme internet-facing \
  --subnets ${PUBLIC_SUBNET_1} ${PUBLIC_SUBNET_2} \
  --security-groups ${ALB_SG} \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns ${ALB_ARN} \
  --query 'LoadBalancers[0].DNSName' --output text)

echo "ALB ARN: ${ALB_ARN}"
echo "ALB DNS: ${ALB_DNS}"
echo "Your API will be accessible at: http://${ALB_DNS}"
```

### 10.3 Create Target Group

```bash
TG_ARN=$(aws elbv2 create-target-group \
  --name brinex-api-gateway-tg \
  --protocol HTTP \
  --port 3400 \
  --vpc-id ${VPC_ID} \
  --target-type ip \
  --health-check-path "/api/v1" \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

echo "Target Group ARN: ${TG_ARN}"
```

### 10.4 Create Listener

```bash
# HTTP listener (port 80) — forwards to API Gateway
aws elbv2 create-listener \
  --load-balancer-arn ${ALB_ARN} \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=${TG_ARN}

echo "ALB Listener created on port 80"
```

> **No HTTPS needed right now.** The ALB DNS name works over HTTP. When you get a domain later, you can add HTTPS — see [Step 16.5](#165-future-adding-a-domain--https-later).

---

## Step 11: Create ECS Services

### 11.1 Set Up AWS Cloud Map for Service Discovery

Before creating ECS services, set up Cloud Map so services can find each other by DNS name (like `auth-service.brinex.local`).

```bash
# Create a private DNS namespace
NAMESPACE_ID=$(aws servicediscovery create-private-dns-namespace \
  --name brinex.local \
  --vpc ${VPC_ID} \
  --query 'OperationId' --output text)

# Wait for the namespace to be created (takes a few seconds)
sleep 10

# Get the namespace ID
NAMESPACE_ID=$(aws servicediscovery list-namespaces \
  --query "Namespaces[?Name=='brinex.local'].Id" --output text)

echo "Cloud Map Namespace ID: ${NAMESPACE_ID}"
```

### 11.2 Create the API Gateway ECS Service (with ALB)

```bash
aws ecs create-service \
  --cluster brinex-cluster \
  --service-name api-gateway \
  --task-definition brinex-api-gateway \
  --desired-count 1 \
  --launch-type EC2 \
  --network-configuration '{
    "awsvpcConfiguration": {
      "subnets": ["'"${PUBLIC_SUBNET_1}"'", "'"${PUBLIC_SUBNET_2}"'"],
      "securityGroups": ["'"${EC2_SG}"'"]
    }
  }' \
  --load-balancers '[
    {
      "targetGroupArn": "'"${TG_ARN}"'",
      "containerName": "api-gateway",
      "containerPort": 3400
    }
  ]' \
  --service-registries '[
    {
      "registryArn": "'"$(aws servicediscovery create-service \
        --name api-gateway \
        --namespace-id ${NAMESPACE_ID} \
        --dns-config 'RoutingPolicy=MULTIVALUE,DnsRecords=[{Type=A,TTL=10}]' \
        --query 'Service.Arn' --output text)"'"
    }
  ]' \
  --enable-execute-command

echo "API Gateway service created!"
```

### 11.3 Create All gRPC Services (internal, no ALB)

```bash
# Function to create an internal ECS service with Cloud Map discovery
create_internal_service() {
  local SERVICE_NAME=$1
  local PORT=$2
  local DESIRED_COUNT=${3:-1}

  # Create Cloud Map service discovery entry
  local REGISTRY_ARN=$(aws servicediscovery create-service \
    --name ${SERVICE_NAME} \
    --namespace-id ${NAMESPACE_ID} \
    --dns-config 'RoutingPolicy=MULTIVALUE,DnsRecords=[{Type=A,TTL=10}]' \
    --query 'Service.Arn' --output text)

  # Create ECS service
  aws ecs create-service \
    --cluster brinex-cluster \
    --service-name ${SERVICE_NAME} \
    --task-definition brinex-${SERVICE_NAME} \
    --desired-count ${DESIRED_COUNT} \
    --launch-type EC2 \
    --network-configuration '{
      "awsvpcConfiguration": {
        "subnets": ["'"${PUBLIC_SUBNET_1}"'", "'"${PUBLIC_SUBNET_2}"'"],
        "securityGroups": ["'"${EC2_SG}"'"]
      }
    }' \
    --service-registries '[{"registryArn": "'"${REGISTRY_ARN}"'"}]' \
    --enable-execute-command

  echo "Created service: ${SERVICE_NAME} (port ${PORT})"
}

# Create all internal services
create_internal_service "auth-service" 50000
create_internal_service "user-service" 50053
create_internal_service "crystallization-service" 50054
create_internal_service "crystallization-onnx-service" 50055
create_internal_service "vision-service" 50057
create_internal_service "payment-service" 50056
create_internal_service "compass-service" 50052
create_internal_service "waste-valorization-service" 50058
create_internal_service "email-service" 0       # Kafka consumer, no port
create_internal_service "audit-log-service" 0   # Kafka consumer, no port

echo "All services created!"
```

### 11.4 Verify All Services Are Running

```bash
# Check service status
aws ecs list-services --cluster brinex-cluster --query 'serviceArns' --output table

# Check if tasks are RUNNING
aws ecs describe-services --cluster brinex-cluster \
  --services api-gateway auth-service user-service \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount,status:status}' \
  --output table
```

---

## Step 12: Service Discovery

Cloud Map was set up in Step 11. Here's how it works:

### How Docker Compose Names Map to Cloud Map DNS

| Docker Compose (local) | AWS Cloud Map (production) |
|------------------------|---------------------------|
| `auth-service:50000` | `auth-service.brinex.local:50000` |
| `user-service:50053` | `user-service.brinex.local:50053` |
| `crystallization-service:50054` | `crystallization-service.brinex.local:50054` |
| `crystallization-onnx-service:50055` | `crystallization-onnx-service.brinex.local:50055` |
| `vision-service:50057` | `vision-service.brinex.local:50057` |
| `payment-service:50056` | `payment-service.brinex.local:50056` |
| `compass-service:50052` | `compass-service.brinex.local:50052` |
| `waste-valorization-service:50058` | `waste-valorization-service.brinex.local:50058` |
| `kafka:9092` | MSK broker endpoint (set as `KAFKA_BROKER` env var) |

### What changed in your code?

**Nothing!** The environment variables in the task definitions already use `*.brinex.local` hostnames. Your NestJS services read `AUTH_SERVICE_URL`, `USER_SERVICE_URL`, etc. from environment variables, so no code changes are needed.

---

## Step 13: Configure Security Groups

Security groups were created in Step 10. Here's a summary of the rules:

### Security Group Rules Summary

| Security Group | Inbound Rules | Purpose |
|----------------|---------------|---------|
| `brinex-alb-sg` | Port 80 from `0.0.0.0/0` | HTTP from Internet |
| `brinex-ec2-sg` | Port 3400 from `brinex-alb-sg` | ALB → API Gateway |
| | All ports from `brinex-ec2-sg` (self) | gRPC between services |
| `brinex-msk-sg` | Port 9092 from `10.0.0.0/16` | Kafka from VPC |

### MongoDB Atlas Network Access

Add your **EC2 instance public IPs** to MongoDB Atlas's IP whitelist:

```bash
# Get public IPs of your ECS EC2 instances
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=brinex-ecs-instance" "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].PublicIpAddress' --output text
```

1. Go to **MongoDB Atlas** → **Network Access** → **Add IP Address**
2. Add each EC2 instance's public IP
3. **Or** (easier): Click **"Allow Access from Anywhere"** (`0.0.0.0/0`) for development — tighten this later for production

> **Tip:** If your Auto Scaling Group scales up and adds new instances, you'll need to whitelist the new IPs too. Using `0.0.0.0/0` during development avoids this hassle. For production, consider using a NAT Gateway with a fixed Elastic IP or VPC Peering with MongoDB Atlas.

---

## Step 14: CI/CD with GitHub Actions

Automate builds and deployments whenever you push code.

### 14.1 Add AWS Credentials to GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | Your IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | Your IAM user secret key |
| `AWS_REGION` | `ap-south-1` |
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID |

### 14.2 Create the Workflow File

Create `.github/workflows/deploy-ecs.yml`:

```yaml
name: Deploy to AWS ECS

on:
  push:
    branches: [master]

env:
  AWS_REGION: ${{ secrets.AWS_REGION }}
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.${{ secrets.AWS_REGION }}.amazonaws.com
  ECS_CLUSTER: brinex-cluster

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.changes.outputs.services }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
      - id: changes
        run: |
          # Detect which services changed
          CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD)
          SERVICES=()

          # Check each service directory
          for svc in api-gateway auth-service user-service crystallization-service \
            crystallization-onnx-service vision-service payment-service \
            compass-service waste-valorization-service email-service audit-log-service; do
            if echo "$CHANGED_FILES" | grep -q "apps/${svc}/\|proto/\|package.json"; then
              SERVICES+=("${svc}")
            fi
          done

          # If shared files changed, rebuild all
          if echo "$CHANGED_FILES" | grep -q "^Dockerfile$\|^tsconfig\|^nx.json"; then
            SERVICES=(api-gateway auth-service user-service crystallization-service \
              crystallization-onnx-service vision-service payment-service \
              compass-service waste-valorization-service email-service audit-log-service)
          fi

          echo "services=$(echo ${SERVICES[@]} | jq -R -s -c 'split(" ") | map(select(. != ""))')" >> $GITHUB_OUTPUT

  deploy:
    needs: detect-changes
    if: needs.detect-changes.outputs.services != '[]'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: ${{ fromJson(needs.detect-changes.outputs.services) }}
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Determine Dockerfile
        id: dockerfile
        run: |
          if [ "${{ matrix.service }}" = "crystallization-onnx-service" ]; then
            echo "path=apps/crystallization-onnx-service/Dockerfile" >> $GITHUB_OUTPUT
            echo "build_args=" >> $GITHUB_OUTPUT
          elif [ "${{ matrix.service }}" = "vision-service" ]; then
            echo "path=apps/vision-service/Dockerfile" >> $GITHUB_OUTPUT
            echo "build_args=" >> $GITHUB_OUTPUT
          else
            echo "path=Dockerfile" >> $GITHUB_OUTPUT
            echo "build_args=SERVICE_NAME=${{ matrix.service }}" >> $GITHUB_OUTPUT
          fi

      - name: Build and push Docker image
        run: |
          IMAGE_TAG="${{ env.ECR_REGISTRY }}/brinex/${{ matrix.service }}:${{ github.sha }}"
          IMAGE_LATEST="${{ env.ECR_REGISTRY }}/brinex/${{ matrix.service }}:latest"

          BUILD_ARGS=""
          if [ -n "${{ steps.dockerfile.outputs.build_args }}" ]; then
            BUILD_ARGS="--build-arg ${{ steps.dockerfile.outputs.build_args }}"
          fi

          docker build \
            -f ${{ steps.dockerfile.outputs.path }} \
            ${BUILD_ARGS} \
            -t ${IMAGE_TAG} \
            -t ${IMAGE_LATEST} \
            .

          docker push ${IMAGE_TAG}
          docker push ${IMAGE_LATEST}

      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster ${{ env.ECS_CLUSTER }} \
            --service ${{ matrix.service }} \
            --force-new-deployment

          echo "Deployed ${{ matrix.service }} with image tag ${{ github.sha }}"
```

### How it works:

1. **Push to `master`** triggers the workflow
2. **Change detection** — only rebuilds services whose code changed
3. **Parallel builds** — each changed service builds and pushes in parallel
4. **Rolling update** — `force-new-deployment` tells ECS to pull the new image and gradually replace old containers

---

## Step 15: Monitoring & Logging

### 15.1 View Logs in CloudWatch

```bash
# View logs for a specific service
aws logs tail /ecs/brinex/api-gateway --follow

# View logs for all services
aws logs tail /ecs/brinex/auth-service --since 1h
```

### 15.2 ECS Exec (SSH into a running container)

```bash
# Get a task ID
TASK_ID=$(aws ecs list-tasks --cluster brinex-cluster \
  --service-name api-gateway \
  --query 'taskArns[0]' --output text | awk -F/ '{print $NF}')

# Open a shell inside the container
aws ecs execute-command \
  --cluster brinex-cluster \
  --task ${TASK_ID} \
  --container api-gateway \
  --interactive \
  --command "/bin/sh"
```

### 15.3 Set Up CloudWatch Alarms

```bash
# Alarm: API Gateway high CPU (> 80%)
aws cloudwatch put-metric-alarm \
  --alarm-name "brinex-api-gateway-high-cpu" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --dimensions Name=ClusterName,Value=brinex-cluster Name=ServiceName,Value=api-gateway \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions "arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:brinex-alerts"

# Alarm: Any service has 0 running tasks
aws cloudwatch put-metric-alarm \
  --alarm-name "brinex-api-gateway-no-tasks" \
  --metric-name RunningTaskCount \
  --namespace ECS/ContainerInsights \
  --dimensions Name=ClusterName,Value=brinex-cluster Name=ServiceName,Value=api-gateway \
  --statistic Average \
  --period 60 \
  --threshold 1 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:brinex-alerts"
```

### 15.4 Auto-Scaling (Optional)

With EC2 launch type, you have **two levels of scaling**:

**Level 1 — Scale ECS Services** (add more container replicas):
```bash
# Scale api-gateway to 2 replicas
aws ecs update-service --cluster brinex-cluster \
  --service api-gateway --desired-count 2
```

**Level 2 — Scale EC2 Instances** (add more machines when containers don't fit):
```bash
# Scale to 2 EC2 instances (for high availability or more capacity)
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name brinex-ecs-asg \
  --desired-capacity 2

# Or set up automatic scaling based on cluster CPU reservation
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name brinex-ecs-asg \
  --policy-name brinex-scale-out \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ASGAverageCPUUtilization"
    },
    "TargetValue": 70.0
  }'
```

> **Note:** The ECS Capacity Provider we set up in Step 5.7 handles this automatically — when ECS can't place a task on existing instances, it tells the ASG to scale out.

---

## Step 16: Accessing Your API (No Domain Required)

You **don't need a domain** to use your API. The ALB provides a free auto-generated DNS name.

### 16.1 Get Your ALB DNS Name

```bash
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names brinex-alb \
  --query 'LoadBalancers[0].DNSName' --output text)

echo "Your API is live at: http://${ALB_DNS}/api/v1"
# Example: http://brinex-alb-1234567890.ap-south-1.elb.amazonaws.com/api/v1
```

This DNS name is **permanent** (as long as the ALB exists) and works immediately. Use it everywhere you previously used `localhost:3400`.

### 16.2 Test Your API

```bash
# Health check / Swagger docs
curl http://${ALB_DNS}/api/v1

# Test an actual endpoint
curl http://${ALB_DNS}/api/v1/auth/health
```

### 16.3 Update PayHere Notify URL

Since PayHere needs a public callback URL, update the secret:

```bash
aws secretsmanager update-secret \
  --secret-id brinex/payhere-notify-url \
  --secret-string "http://${ALB_DNS}/api/v1/payment/notify"
```

### 16.4 Update Frontend to Point to ALB

```env
# .env.production (in Frontend repo)
NEXT_PUBLIC_API_BASE_URL=http://brinex-alb-XXXXXXXXX.ap-south-1.elb.amazonaws.com/api/v1
NEXT_PUBLIC_VISION_WS_URL=http://brinex-alb-XXXXXXXXX.ap-south-1.elb.amazonaws.com
```

Replace `brinex-alb-XXXXXXXXX.ap-south-1.elb.amazonaws.com` with your actual ALB DNS from step 16.1.

### 16.5 (Future) Adding a Domain & HTTPS Later

When you eventually get a domain, here's what to do:

1. **Buy a domain** from Route 53, Namecheap, GoDaddy, etc. (~$10–15/year)
2. **Create a hosted zone** in Route 53 (if not using Route 53 as registrar, point your registrar's nameservers to Route 53)
3. **Request an SSL certificate** (free) from AWS Certificate Manager (ACM):
   ```bash
   aws acm request-certificate \
     --domain-name "api.yourdomain.com" \
     --validation-method DNS
   ```
4. **Add DNS validation record** (ACM tells you what CNAME to add)
5. **Add HTTPS listener** to your ALB:
   ```bash
   aws elbv2 create-listener \
     --load-balancer-arn ${ALB_ARN} \
     --protocol HTTPS --port 443 \
     --certificates CertificateArn=<your-cert-arn> \
     --default-actions Type=forward,TargetGroupArn=${TG_ARN}
   ```
6. **Create DNS alias record** pointing `api.yourdomain.com` to the ALB
7. **Redirect HTTP to HTTPS** on the ALB's port 80 listener

> Until you have a domain, HTTP on the ALB DNS name works perfectly fine for development, testing, and demos.

---

## Cost Estimation

### Monthly Cost Breakdown (ap-south-1 region)

| Resource | Specification | Estimated Cost |
|----------|--------------|----------------|
| **EC2 Instance** | 1x t3.xlarge (4 vCPU, 16 GB) On-Demand | ~$120 |
| **Amazon MSK** | 2x kafka.t3.small | ~$60 |
| **ALB** | 1x, minimal traffic | ~$20 |
| **ECR** | Image storage (~5 GB) | ~$1 |
| **CloudWatch Logs** | ~5 GB/month | ~$3 |
| **Secrets Manager** | ~13 secrets | ~$5 |
| **EBS Storage** | 50 GB gp3 | ~$4 |
| **Route 53 + Domain** | Not needed (use ALB DNS) | $0 |
| **NAT Gateway** | Not needed (public subnets) | $0 |
| **Total** | | **~$213/month** |

### Cost Optimization Tips

1. **Use Reserved Instances** — commit to 1-year t3.xlarge RI and pay ~$75/month instead of $120 (37% savings)
2. **Use Spot Instances** — t3.xlarge spot is ~$36/month (70% savings), but can be interrupted. Good for dev/test.
3. **Use self-managed Kafka on ECS** instead of MSK — saves ~$50/month (see [Appendix A](#appendix-a-self-managed-kafka-on-ecs))
4. **Downsize to t3.large** — if you drop vision-service locally, 2 vCPU / 8 GB may be enough (~$60/month)
5. **Stop instances** during off-hours via scheduled ASG scaling — saves ~50% if you only run 12 hrs/day

### Cheapest Possible Setup (Dev/Testing)

| Resource | Specification | Cost |
|----------|--------------|------|
| EC2 Spot Instance | 1x t3.xlarge spot | ~$36 |
| Self-managed Kafka | On same EC2 instance | $0 |
| ALB | 1x | ~$20 |
| Other (ECR, logs, secrets, EBS) | | ~$13 |
| **Total** | | **~$69/month** |

---

## Troubleshooting

### Service won't start / task keeps stopping

```bash
# Check stopped task reason
aws ecs describe-tasks --cluster brinex-cluster \
  --tasks $(aws ecs list-tasks --cluster brinex-cluster \
    --service-name api-gateway --desired-status STOPPED \
    --query 'taskArns[0]' --output text) \
  --query 'tasks[0].{reason:stoppedReason,exitCode:containers[0].exitCode}'

# Check CloudWatch logs
aws logs tail /ecs/brinex/api-gateway --since 30m
```

### Service can't connect to another service

```bash
# Verify Cloud Map registration
aws servicediscovery list-instances \
  --service-id $(aws servicediscovery list-services \
    --query "Services[?Name=='auth-service'].Id" --output text)

# Test DNS resolution from inside a container
aws ecs execute-command --cluster brinex-cluster \
  --task <task-id> --container api-gateway --interactive \
  --command "nslookup auth-service.brinex.local"
```

### Service can't connect to MongoDB Atlas

1. Verify EC2 instance public IPs are whitelisted in MongoDB Atlas Network Access (or use `0.0.0.0/0` for dev)
2. Check that EC2 instances have public IPs and Internet Gateway route
3. Test connectivity:
```bash
aws ecs execute-command --cluster brinex-cluster \
  --task <task-id> --container api-gateway --interactive \
  --command "node -e \"require('mongoose').connect(process.env.MONGO_URI).then(() => console.log('OK')).catch(e => console.error(e))\""
```

### Image pull fails

```bash
# Verify ECR image exists
aws ecr describe-images --repository-name brinex/api-gateway

# Re-authenticate Docker to ECR (token expires every 12 hours)
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${ECR_URI}
```

### Task runs out of memory

Increase the memory in the task definition:
```bash
# Update the task definition JSON and re-register
# Then update the service to use the new revision
aws ecs update-service --cluster brinex-cluster \
  --service api-gateway \
  --task-definition brinex-api-gateway \
  --force-new-deployment
```

### ECS can't place tasks (not enough resources on EC2 instance)

If you see "service was unable to place a task because no container instance met all requirements":

```bash
# Check how much CPU/memory is left on the instance
aws ecs describe-container-instances --cluster brinex-cluster \
  --container-instances $(aws ecs list-container-instances \
    --cluster brinex-cluster --query 'containerInstanceArns[0]' --output text) \
  --query 'containerInstances[0].remainingResources'

# Option 1: Scale up — add another EC2 instance
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name brinex-ecs-asg --desired-capacity 2

# Option 2: Reduce task CPU/memory in the task definition
# Option 3: Upgrade to a larger instance type in the launch template
```

### EC2 instance not joining the cluster

```bash
# Check if the instance is running
aws ec2 describe-instances --filters "Name=tag:Name,Values=brinex-ecs-instance" \
  --query 'Reservations[*].Instances[*].{id:InstanceId,state:State.Name}'

# SSH into the instance via SSM and check ECS Agent
aws ssm start-session --target <instance-id>
# Then inside the instance:
# cat /etc/ecs/ecs.config           (verify cluster name)
# sudo systemctl status ecs          (verify agent is running)
# curl -s http://localhost:51678/v1/metadata | python3 -m json.tool  (agent status)
```

---

## Quick Reference — Useful Commands

```bash
# List all running services
aws ecs list-services --cluster brinex-cluster --output table

# List EC2 instances in the cluster
aws ecs list-container-instances --cluster brinex-cluster

# Scale a service up/down
aws ecs update-service --cluster brinex-cluster \
  --service api-gateway --desired-count 2

# Force redeploy (pull latest image)
aws ecs update-service --cluster brinex-cluster \
  --service api-gateway --force-new-deployment

# View running tasks
aws ecs list-tasks --cluster brinex-cluster --service-name api-gateway

# Stream logs
aws logs tail /ecs/brinex/api-gateway --follow

# SSH into a container
aws ecs execute-command --cluster brinex-cluster \
  --task <task-id> --container api-gateway --interactive --command "/bin/sh"

# SSH into the EC2 instance itself (via SSM Session Manager — no SSH key needed)
aws ssm start-session --target <instance-id>

# Check EC2 instance resource usage
aws ecs describe-container-instances --cluster brinex-cluster \
  --container-instances $(aws ecs list-container-instances \
    --cluster brinex-cluster --query 'containerInstanceArns' --output text) \
  --query 'containerInstances[*].{id:ec2InstanceId,cpu:remainingResources[?name==`CPU`].integerValue,memory:remainingResources[?name==`MEMORY`].integerValue}'

# Scale EC2 instances (add a 2nd instance for HA)
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name brinex-ecs-asg --desired-capacity 2

# Tear down everything (DANGER — destroys all resources)
# aws ecs delete-service --cluster brinex-cluster --service api-gateway --force
# aws autoscaling delete-auto-scaling-group --auto-scaling-group-name brinex-ecs-asg --force-delete
# aws ecs delete-cluster --cluster brinex-cluster
# ... (delete ALB, VPC, MSK, etc.)
```

---

## Appendix A: Self-Managed Kafka on ECS

If Amazon MSK is too expensive (~$60/month), you can run Kafka and Zookeeper as ECS services on your existing EC2 instance at no extra cost:

```bash
# Create task definition for Zookeeper
cat > /tmp/zookeeper-task.json << EOF
{
  "family": "brinex-zookeeper",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "zookeeper",
      "image": "confluentinc/cp-zookeeper:7.5.0",
      "essential": true,
      "portMappings": [{"containerPort": 2181, "protocol": "tcp"}],
      "environment": [
        {"name": "ZOOKEEPER_CLIENT_PORT", "value": "2181"},
        {"name": "ZOOKEEPER_TICK_TIME", "value": "2000"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/zookeeper",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF
aws ecs register-task-definition --cli-input-json file:///tmp/zookeeper-task.json

# Create task definition for Kafka
cat > /tmp/kafka-task.json << EOF
{
  "family": "brinex-kafka",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["EC2"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "kafka",
      "image": "confluentinc/cp-kafka:7.5.0",
      "essential": true,
      "portMappings": [{"containerPort": 9092, "protocol": "tcp"}],
      "environment": [
        {"name": "KAFKA_BROKER_ID", "value": "1"},
        {"name": "KAFKA_ZOOKEEPER_CONNECT", "value": "zookeeper.brinex.local:2181"},
        {"name": "KAFKA_ADVERTISED_LISTENERS", "value": "PLAINTEXT://kafka.brinex.local:9092"},
        {"name": "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP", "value": "PLAINTEXT:PLAINTEXT"},
        {"name": "KAFKA_INTER_BROKER_LISTENER_NAME", "value": "PLAINTEXT"},
        {"name": "KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR", "value": "1"},
        {"name": "KAFKAJS_NO_PARTITIONER_WARNING", "value": "1"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/brinex/kafka",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF
aws ecs register-task-definition --cli-input-json file:///tmp/kafka-task.json

# Then use KAFKA_BROKER=kafka.brinex.local:9092 in all service task definitions
```

> **Warning:** Self-managed Kafka on ECS has no persistent storage by default. If the task restarts, Kafka data is lost. For production, either use MSK or mount a Docker volume to the EC2 instance's EBS disk for Kafka data persistence.

---

## Deployment Order Checklist

Follow this order to avoid dependency issues:

- [ ] 1. VPC, Subnets, Internet Gateway (Step 4) — no NAT Gateway needed
- [ ] 2. Security Groups (Steps 5.3, 10)
- [ ] 3. ECR Repositories (Step 2)
- [ ] 4. Build & Push Docker Images (Step 3)
- [ ] 5. Secrets Manager / SSM Parameters (Step 6)
- [ ] 6. IAM Roles (Step 7)
- [ ] 7. ECS Cluster + EC2 Instance Role + Launch Template + ASG (Step 5) — wait for instance to join
- [ ] 8. MSK Kafka Cluster (Step 8) — wait until ACTIVE
- [ ] 9. Cloud Map Namespace (Step 11.1)
- [ ] 10. ALB + Target Group + Listener (Step 10)
- [ ] 11. Task Definitions for all services (Step 9)
- [ ] 12. ECS Services — start in this order:
    - [ ] a. Kafka consumers: `email-service`, `audit-log-service`
    - [ ] b. ML services: `crystallization-onnx-service`
    - [ ] c. Core gRPC services: `auth-service`, `user-service`, `crystallization-service`, `vision-service`, `payment-service`, `compass-service`, `waste-valorization-service`
    - [ ] d. API Gateway: `api-gateway` (last — depends on all others)
- [ ] 13. MongoDB Atlas — whitelist EC2 instance IPs or allow `0.0.0.0/0` for dev (Step 13)
- [ ] 14. Test API via ALB DNS name (Step 16)
- [ ] 15. Update Frontend env vars with ALB DNS (Step 16.4)
- [ ] 16. CI/CD pipeline (Step 14)
- [ ] 17. Monitoring & Alarms (Step 15)
