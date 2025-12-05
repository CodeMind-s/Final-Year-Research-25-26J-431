import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Request, Response } from 'express';

@Catch()
export class GrpcExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    // Handle gRPC-specific error codes
    if (exception?.code !== undefined) {
      switch (exception.code) {
        case 2: // gRPC UNKNOWN
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = exception.details || 'Internal server error';
          break;
        case 3: // gRPC INVALID_ARGUMENT
          status = HttpStatus.BAD_REQUEST;
          message = exception.details || 'Invalid argument';
          break;
        case 5: // gRPC NOT_FOUND
          status = HttpStatus.NOT_FOUND;
          message = exception.details || 'Not found';
          break;
        case 16: // gRPC UNAVAILABLE
          status = HttpStatus.SERVICE_UNAVAILABLE;
          message = exception.details || 'Service unavailable';
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = exception.details || 'Unknown gRPC error';
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    } else if (exception instanceof RpcException) {
      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    };

    response.status(status).json(errorResponse);
  }
}