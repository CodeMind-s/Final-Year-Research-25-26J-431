import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    const startTime = Date.now();
    const { method, url, ip, headers, body, params, query } = request;
    
    // Extract user information from JWT token if available
    const user = request.user;
    const userId = user?.userId || user?.sub || user?.id || null;
    
    // Get user agent
    const userAgent = headers['user-agent'] || 'unknown';
    
    // Get the client IP (handle proxy scenarios)
    const clientIp = headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     headers['x-real-ip'] || 
                     ip || 
                     'unknown';

    // Extract resource information from URL
    const pathParts = url.split('/').filter((p: string) => p && p !== 'api' && p !== 'v1');
    const resourceType = pathParts[0] || 'unknown';
    const resourceId = params?.id || params?.userId || params?.logId || null;

    // Determine action based on HTTP method and path
    const action = this.determineAction(method, pathParts);

    return next.handle().pipe(
      tap((responseData) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Log successful request
        this.auditLogService.createAuditLog({
          serviceName: 'api-gateway',
          action,
          userId,
          resourceId,
          resourceType,
          details: JSON.stringify({
            query,
            params,
            bodyKeys: body ? Object.keys(body) : [],
            responseStatus: statusCode,
          }),
          status: statusCode >= 200 && statusCode < 400 ? 'success' : 'warning',
          ipAddress: clientIp,
          method,
          path: url,
          statusCode,
          duration,
          userAgent,
        }).catch((err) => {
          this.logger.error(`Failed to create audit log: ${err.message}`);
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || error.statusCode || 500;

        // Log failed request
        this.auditLogService.createAuditLog({
          serviceName: 'api-gateway',
          action,
          userId,
          resourceId,
          resourceType,
          details: JSON.stringify({
            query,
            params,
            bodyKeys: body ? Object.keys(body) : [],
            errorMessage: error.message,
            errorName: error.name,
          }),
          status: 'error',
          ipAddress: clientIp,
          method,
          path: url,
          statusCode,
          duration,
          userAgent,
        }).catch((err) => {
          this.logger.error(`Failed to create audit log: ${err.message}`);
        });

        return throwError(() => error);
      }),
    );
  }

  private determineAction(method: string, pathParts: string[]): string {
    const resource = pathParts[0]?.toUpperCase() || 'RESOURCE';
    
    switch (method) {
      case 'GET':
        return pathParts.length > 1 ? `${resource}_READ` : `${resource}_LIST`;
      case 'POST':
        return `${resource}_CREATE`;
      case 'PUT':
      case 'PATCH':
        return `${resource}_UPDATE`;
      case 'DELETE':
        return `${resource}_DELETE`;
      default:
        return `${resource}_${method}`;
    }
  }
}
