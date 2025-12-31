import { Controller, UseGuards, Inject, Post, Get, Param } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { SubscriptionCheck } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { Logger, HttpStatus, HttpException } from '@nestjs/common';
import {
  GenerateInvoiceResponseDto,
  GetInvoiceResponseDto,
  DownloadInvoiceResponseDto,
} from './dtos/invoice.dto';

@ApiTags('Compass - Invoice')
@Controller('compass/invoice')
export class InvoiceController {
  private invoiceService: any;
  private readonly logger = new Logger(InvoiceController.name);

  constructor(@Inject('COMPASS_INVOICE_PACKAGE') private client: ClientGrpcProxy) {
    this.invoiceService = this.client.getService('InvoiceService');
  }

  @Post('generate/:dealId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate invoice for a deal' })
  @ApiParam({ name: 'dealId', type: String })
  @ApiResponse({ status: 201, description: 'Invoice generated successfully', type: GenerateInvoiceResponseDto })
  async generateInvoice(@Param('dealId') dealId: string): Promise<GenerateInvoiceResponseDto> {
    try {
      const result = await firstValueFrom(
        this.invoiceService.GenerateInvoice({ dealId }).pipe(
          catchError((error) => {
            this.logger.error(`Generate Invoice error: ${error.message}`);
            throw new HttpException('Failed to generate invoice', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get(':invoiceId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiParam({ name: 'invoiceId', type: String })
  @ApiResponse({ status: 200, description: 'Invoice fetched successfully', type: GetInvoiceResponseDto })
  async getInvoice(@Param('invoiceId') invoiceId: string): Promise<GetInvoiceResponseDto> {
    try {
      const result = await firstValueFrom(
        this.invoiceService.GetInvoice({ invoiceId }).pipe(
          catchError((error) => {
            this.logger.error(`Get Invoice error: ${error.message}`);
            throw new HttpException('Failed to fetch invoice', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('download/:invoiceId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download invoice PDF' })
  @ApiParam({ name: 'invoiceId', type: String })
  @ApiResponse({ status: 200, description: 'Invoice downloaded successfully', type: DownloadInvoiceResponseDto })
  async downloadInvoice(@Param('invoiceId') invoiceId: string): Promise<DownloadInvoiceResponseDto> {
    try {
      const result = await firstValueFrom(
        this.invoiceService.DownloadInvoice({ invoiceId }).pipe(
          catchError((error) => {
            this.logger.error(`Download Invoice error: ${error.message}`);
            throw new HttpException('Failed to download invoice', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }
}
