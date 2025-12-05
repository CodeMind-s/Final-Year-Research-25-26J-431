# Brinex - Traveller Platform Server

A microservices-based travel platform built with NestJS and Nx monorepo.

## Overview

This platform consists of the following services:

- **API Gateway** - Main entry point for all client requests
- **Auth Service** - Authentication and authorization
- **Crystallization Service** - Itinerary planning and management
- **Logs Service** - Logging and monitoring
- **User Service** - User management

## Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- npm or yarn
- Docker (for containerized services)

### Installation

```bash
npm install
```

### Running the Application

To start all services in development mode:

```bash
nx run-many -t serve --all
```

To start a specific service:

```bash
nx serve <service-name>
```

Available services: `api-gateway`, `auth-service`, `crystallization-service`, `logs-service`, `user-service`

## Project Structure

```
apps/
├── api-gateway/         # API Gateway service
├── auth-service/        # Authentication service
├── crystallization-service/  # Itinerary planning service
├── logs-service/        # Logging service
└── user-service/        # User management service

packages/               # Shared packages
proto/                 # Protocol buffer definitions
types/                 # Shared TypeScript types
```

## Useful Commands

- `nx graph` - Visualize the project graph
- `nx build <service-name>` - Build a specific service
- `nx test <service-name>` - Run tests for a specific service
- `nx lint <service-name>` - Lint a specific service
