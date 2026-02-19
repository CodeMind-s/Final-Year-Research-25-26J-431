import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ClientGrpc } from '@nestjs/microservices';
import { RpcException } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { randomUUID } from 'crypto';
import { Payment } from './schemas/payment.schema';
import { PayHereService } from './payhere.service';
import { status as GrpcStatus } from '@grpc/grpc-js';

interface AuthService {
  GetPlan(data: { plan_key: string }): Observable<{
    success: boolean;
    plan: {
      key: string;
      name: string;
      price_monthly_lkr: number;
      price_annual_lkr: number;
    };
  }>;
  CreateSubscription(data: {
    user_id: string;
    plan_key: string;
    payment_method: string;
  }): Observable<{ success: boolean; message: string }>;
}

@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);
  private authService: AuthService;

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @Inject('AUTH_PACKAGE') private authClient: ClientGrpc,
    private payHereService: PayHereService,
  ) {}

  onModuleInit() {
    this.authService = this.authClient.getService<AuthService>('AuthService');
  }

  async initiateCheckout(userId: string, planKey: string, billingCycle: string) {
    const merchantId = process.env.PAYHERE_MERCHANT_ID;
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
    const notifyUrl = process.env.PAYHERE_NOTIFY_URL;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (!merchantId || !merchantSecret) {
      throw new RpcException({
        code: GrpcStatus.FAILED_PRECONDITION,
        message: 'PayHere credentials not configured',
      });
    }

    if (!notifyUrl) {
      this.logger.warn(
        'PAYHERE_NOTIFY_URL is not set. PayHere needs a publicly accessible URL to send payment notifications. ' +
        'Use ngrok or a similar tunnel and set PAYHERE_NOTIFY_URL=https://<your-tunnel>/api/v1/payments/notify',
      );
    }

    // Get plan details from auth-service
    let planResponse;
    try {
      planResponse = await firstValueFrom(
        this.authService.GetPlan({ plan_key: planKey }),
      );
    } catch (error: any) {
      this.logger.error(`Failed to get plan: ${error.message}`);
      throw new RpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Plan '${planKey}' not found`,
      });
    }

    if (!planResponse.success || !planResponse.plan) {
      throw new RpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Plan '${planKey}' not found`,
      });
    }

    const plan = planResponse.plan;
    const amount =
      billingCycle === 'annual'
        ? plan.price_annual_lkr
        : plan.price_monthly_lkr;

    const orderId = randomUUID();

    // Create pending payment record
    await this.paymentModel.create({
      userId,
      orderId,
      planKey,
      billingCycle,
      amount,
      currency: 'LKR',
      status: 'pending',
      paymentMethod: 'payhere',
    });

    // Generate PayHere checkout hash
    const hash = this.payHereService.generateCheckoutHash(
      merchantId,
      orderId,
      amount,
      'LKR',
      merchantSecret,
    );

    return {
      success: true,
      merchant_id: merchantId,
      order_id: orderId,
      hash,
      amount,
      currency: 'LKR',
      items: `${plan.name} - ${billingCycle}`,
      notify_url: notifyUrl || `${frontendUrl}/api/v1/payments/notify`,
      return_url: `${frontendUrl}/payments/success`,
      cancel_url: `${frontendUrl}/payments/cancel`,
    };
  }

  async handleNotification(params: {
    merchant_id: string;
    order_id: string;
    payment_id: string;
    payhere_amount: string;
    payhere_currency: string;
    status_code: string;
    md5sig: string;
  }) {
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;

    if (!merchantSecret) {
      throw new RpcException({
        code: GrpcStatus.FAILED_PRECONDITION,
        message: 'PayHere merchant secret not configured',
      });
    }

    // Validate hash
    const isValid = this.payHereService.validateNotificationHash(
      params.merchant_id,
      params.order_id,
      params.payhere_amount,
      params.payhere_currency,
      params.status_code,
      params.md5sig,
      merchantSecret,
    );

    if (!isValid) {
      this.logger.warn(`Invalid PayHere notification hash for order ${params.order_id}`);
      throw new RpcException({
        code: GrpcStatus.PERMISSION_DENIED,
        message: 'Invalid notification hash',
      });
    }

    // Find payment record
    const payment = await this.paymentModel.findOne({ orderId: params.order_id });
    if (!payment) {
      throw new RpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Payment not found for order ${params.order_id}`,
      });
    }

    // Map PayHere status_code to payment status
    const statusMap: Record<string, string> = {
      '2': 'success',
      '0': 'pending',
      '-1': 'cancelled',
      '-2': 'failed',
      '-3': 'failed',
    };
    const paymentStatus = statusMap[params.status_code] || 'failed';

    // Update payment record
    payment.status = paymentStatus;
    payment.payHerePaymentId = params.payment_id;
    payment.payHereMd5Sig = params.md5sig;
    await payment.save();

    this.logger.log(
      `Payment ${params.order_id} updated to status: ${paymentStatus}`,
    );

    // If payment succeeded, activate subscription via auth-service
    if (paymentStatus === 'success') {
      try {
        await firstValueFrom(
          this.authService.CreateSubscription({
            user_id: payment.userId.toString(),
            plan_key: payment.planKey,
            payment_method: 'payhere',
          }),
        );
        this.logger.log(
          `Subscription activated for user ${payment.userId}, plan ${payment.planKey}`,
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to activate subscription for user ${payment.userId}: ${error.message}`,
        );
      }
    }

    return { success: true, message: `Payment status updated to ${paymentStatus}` };
  }

  async getPayments(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      this.paymentModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.paymentModel.countDocuments({ userId }),
    ]);

    return {
      success: true,
      payments: payments.map((p) => this.toPaymentProto(p)),
      total,
      page,
      limit,
    };
  }

  async getPayment(id: string) {
    const payment = await this.paymentModel.findById(id).lean();
    if (!payment) {
      throw new RpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Payment ${id} not found`,
      });
    }

    return {
      success: true,
      payment: this.toPaymentProto(payment),
    };
  }

  private toPaymentProto(p: any) {
    return {
      id: p._id.toString(),
      user_id: p.userId.toString(),
      order_id: p.orderId,
      plan_key: p.planKey,
      billing_cycle: p.billingCycle,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      payment_method: p.paymentMethod,
      payhere_payment_id: p.payHerePaymentId || '',
      created_at: p.createdAt ? { seconds: Math.floor(new Date(p.createdAt).getTime() / 1000), nanos: 0 } : null,
      updated_at: p.updatedAt ? { seconds: Math.floor(new Date(p.updatedAt).getTime() / 1000), nanos: 0 } : null,
    };
  }
}
