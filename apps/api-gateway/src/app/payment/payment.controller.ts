import {
  Controller,
  Inject,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CheckoutDto, PayHereNotifyDto } from './dtos/payment.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  private paymentService: any;
  private readonly logger = new Logger(PaymentController.name);

  constructor(@Inject('PAYMENT_PACKAGE') private client: ClientGrpcProxy) {
    this.paymentService = this.client.getService('PaymentService');
  }

  @Post('checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate PayHere checkout' })
  @ApiBody({ type: CheckoutDto })
  @ApiResponse({ status: 201, description: 'Checkout payload generated' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async checkout(@Body() dto: CheckoutDto, @Req() req: any) {
    try {
      const userId = req.user.userId;
      const result = await firstValueFrom(
        this.paymentService.InitiateCheckout({
          user_id: userId,
          plan_key: dto.planKey,
          billing_cycle: dto.billingCycle,
        }).pipe(
          catchError((error: any) => {
            this.logger.error(`Checkout error: ${error.message}`);
            throw new HttpException(
              error.details || 'Failed to initiate checkout',
              HttpStatus.BAD_REQUEST,
            );
          }),
        ),
      );

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to initiate checkout', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('notify')
  @Public()
  @ApiOperation({ summary: 'PayHere webhook notification' })
  @ApiBody({ type: PayHereNotifyDto })
  @ApiResponse({ status: 200, description: 'Notification processed' })
  async notify(@Body() body: PayHereNotifyDto) {
    try {
      const result = await firstValueFrom(
        this.paymentService.HandleNotification({
          merchant_id: body.merchant_id,
          order_id: body.order_id,
          payment_id: body.payment_id,
          payhere_amount: body.payhere_amount,
          payhere_currency: body.payhere_currency,
          status_code: body.status_code,
          md5sig: body.md5sig,
        }).pipe(
          catchError((error: any) => {
            this.logger.error(`Notification error: ${error.message}`);
            throw new HttpException(
              error.details || 'Failed to process notification',
              HttpStatus.BAD_REQUEST,
            );
          }),
        ),
      );

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to process notification', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment history' })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Payment history retrieved' })
  async getPayments(
    @Req() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    try {
      const userId = req.user.userId;
      const result = await firstValueFrom(
        this.paymentService.GetPayments({
          user_id: userId,
          page: page ? parseInt(page.toString(), 10) : 1,
          limit: limit ? parseInt(limit.toString(), 10) : 10,
        }).pipe(
          catchError((error: any) => {
            this.logger.error(`GetPayments error: ${error.message}`);
            throw new HttpException(
              error.details || 'Failed to fetch payments',
              HttpStatus.BAD_REQUEST,
            );
          }),
        ),
      );

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to fetch payments', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get single payment' })
  @ApiParam({ name: 'id', type: String, description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Payment retrieved' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPayment(@Param('id') id: string) {
    try {
      const result = await firstValueFrom(
        this.paymentService.GetPayment({ id }).pipe(
          catchError((error: any) => {
            this.logger.error(`GetPayment error: ${error.message}`);
            throw new HttpException(
              error.details || 'Failed to fetch payment',
              HttpStatus.BAD_REQUEST,
            );
          }),
        ),
      );

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to fetch payment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
