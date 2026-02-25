import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PaymentService } from './payment.service';

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @GrpcMethod('PaymentService', 'InitiateCheckout')
  async InitiateCheckout(data: {
    user_id: string;
    plan_key: string;
    billing_cycle: string;
  }) {
    return this.paymentService.initiateCheckout(
      data.user_id,
      data.plan_key,
      data.billing_cycle,
    );
  }

  @GrpcMethod('PaymentService', 'HandleNotification')
  async HandleNotification(data: {
    merchant_id: string;
    order_id: string;
    payment_id: string;
    payhere_amount: string;
    payhere_currency: string;
    status_code: string;
    md5sig: string;
  }) {
    return this.paymentService.handleNotification(data);
  }

  @GrpcMethod('PaymentService', 'GetPayments')
  async GetPayments(data: { user_id: string; page: number; limit: number }) {
    const page = data.page || 1;
    const limit = data.limit || 10;
    return this.paymentService.getPayments(data.user_id, page, limit);
  }

  @GrpcMethod('PaymentService', 'GetPayment')
  async GetPayment(data: { id: string }) {
    return this.paymentService.getPayment(data.id);
  }

  @GrpcMethod('PaymentService', 'GetAllPayments')
  async GetAllPayments(data: { page: number; limit: number }) {
    const page = data.page || 1;
    const limit = data.limit || 10;
    return this.paymentService.getAllPayments(page, limit);
  }
}
