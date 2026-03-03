import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { of } from 'rxjs';
import * as path from 'path';

// Load .env.test if available
try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env.test') });
} catch {
  // dotenv not required — env vars may already be set
}

import { Payment, PaymentSchema } from '../../src/app/payment/schemas/payment.schema';
import { PaymentService } from '../../src/app/payment/payment.service';
import { PayHereService } from '../../src/app/payment/payhere.service';

const testMongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/payment-test';

describe('Payment Service E2E Tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let paymentModel: Model<any>;
  let paymentService: PaymentService;

  const createdIds: string[] = [];

  const mockAuthService = {
    GetPlan: jest.fn().mockReturnValue(
      of({
        success: true,
        plan: {
          key: 'pro',
          name: 'Pro Plan',
          price_monthly_lkr: 1500,
          price_annual_lkr: 15000,
        },
      }),
    ),
    CreateSubscription: jest.fn().mockReturnValue(
      of({ success: true, message: 'Subscription created' }),
    ),
  };

  const mockPayHereService = {
    generateCheckoutHash: jest.fn().mockReturnValue('mock-hash-123'),
    validateNotificationHash: jest.fn().mockReturnValue(true),
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(testMongoUri, {
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
        }),
        MongooseModule.forFeature([
          { name: Payment.name, schema: PaymentSchema },
        ]),
      ],
      providers: [
        PaymentService,
        {
          provide: 'AUTH_PACKAGE',
          useValue: {
            getService: () => mockAuthService,
          },
        },
        {
          provide: PayHereService,
          useValue: mockPayHereService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    paymentModel = moduleRef.get(getModelToken(Payment.name));
    paymentService = moduleRef.get(PaymentService);
  }, 30000);

  afterAll(async () => {
    try {
      if (createdIds.length > 0) {
        await paymentModel.deleteMany({
          _id: { $in: createdIds.map((id) => new Types.ObjectId(id)) },
        });
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }

    if (app) {
      await app.close();
    }
  }, 15000);

  // ──────────────── initiateCheckout ────────────────

  describe('initiateCheckout', () => {
    it('should create a pending payment and return checkout data', async () => {
      const userId = new Types.ObjectId().toString();

      const result = await paymentService.initiateCheckout(userId, 'pro', 'monthly');

      expect(result.success).toBe(true);
      expect(result.order_id).toBeDefined();
      expect(result.hash).toBe('mock-hash-123');
      expect(result.amount).toBe(1500);
      expect(result.currency).toBe('LKR');

      // Verify payment record persisted in DB
      const payment = await paymentModel.findOne({ orderId: result.order_id });
      expect(payment).toBeDefined();
      expect(payment.status).toBe('pending');
      expect(payment.userId.toString()).toBe(userId);
      expect(payment.planKey).toBe('pro');
      expect(payment.amount).toBe(1500);

      createdIds.push(payment._id.toString());
    });

    it('should handle annual billing cycle', async () => {
      const userId = new Types.ObjectId().toString();

      const result = await paymentService.initiateCheckout(userId, 'pro', 'annual');

      expect(result.amount).toBe(15000);

      const payment = await paymentModel.findOne({ orderId: result.order_id });
      createdIds.push(payment._id.toString());
    });
  });

  // ──────────────── handleNotification ────────────────

  describe('handleNotification', () => {
    it('should update payment to success on status_code 2', async () => {
      const userId = new Types.ObjectId().toString();
      const checkoutResult = await paymentService.initiateCheckout(userId, 'pro', 'monthly');

      const payment = await paymentModel.findOne({ orderId: checkoutResult.order_id });
      createdIds.push(payment._id.toString());

      const result = await paymentService.handleNotification({
        merchant_id: 'test-merchant',
        order_id: checkoutResult.order_id,
        payment_id: 'payhere-payment-success',
        payhere_amount: '1500.00',
        payhere_currency: 'LKR',
        status_code: '2',
        md5sig: 'valid-sig',
      });

      expect(result.success).toBe(true);

      const updatedPayment = await paymentModel.findOne({ orderId: checkoutResult.order_id });
      expect(updatedPayment.status).toBe('success');
      expect(updatedPayment.payHerePaymentId).toBe('payhere-payment-success');
    });

    it('should update payment to cancelled on status_code -1', async () => {
      const userId = new Types.ObjectId().toString();
      const checkoutResult = await paymentService.initiateCheckout(userId, 'pro', 'monthly');

      const payment = await paymentModel.findOne({ orderId: checkoutResult.order_id });
      createdIds.push(payment._id.toString());

      await paymentService.handleNotification({
        merchant_id: 'test-merchant',
        order_id: checkoutResult.order_id,
        payment_id: 'payhere-cancel',
        payhere_amount: '1500.00',
        payhere_currency: 'LKR',
        status_code: '-1',
        md5sig: 'valid-sig',
      });

      const updatedPayment = await paymentModel.findOne({ orderId: checkoutResult.order_id });
      expect(updatedPayment.status).toBe('cancelled');
    });

    it('should update payment to failed on status_code -2', async () => {
      const userId = new Types.ObjectId().toString();
      const checkoutResult = await paymentService.initiateCheckout(userId, 'pro', 'monthly');

      const payment = await paymentModel.findOne({ orderId: checkoutResult.order_id });
      createdIds.push(payment._id.toString());

      await paymentService.handleNotification({
        merchant_id: 'test-merchant',
        order_id: checkoutResult.order_id,
        payment_id: 'payhere-failed',
        payhere_amount: '1500.00',
        payhere_currency: 'LKR',
        status_code: '-2',
        md5sig: 'valid-sig',
      });

      const updatedPayment = await paymentModel.findOne({ orderId: checkoutResult.order_id });
      expect(updatedPayment.status).toBe('failed');
    });

    it('should reject invalid notification hash', async () => {
      mockPayHereService.validateNotificationHash.mockReturnValueOnce(false);

      const userId = new Types.ObjectId().toString();
      const checkoutResult = await paymentService.initiateCheckout(userId, 'pro', 'monthly');

      const payment = await paymentModel.findOne({ orderId: checkoutResult.order_id });
      createdIds.push(payment._id.toString());

      await expect(
        paymentService.handleNotification({
          merchant_id: 'test-merchant',
          order_id: checkoutResult.order_id,
          payment_id: 'fake-payment',
          payhere_amount: '1500.00',
          payhere_currency: 'LKR',
          status_code: '2',
          md5sig: 'invalid-sig',
        }),
      ).rejects.toThrow();
    });
  });

  // ──────────────── getPayments ────────────────

  describe('getPayments', () => {
    it('should get payments by userId with pagination', async () => {
      const userId = new Types.ObjectId().toString();

      // Create payments via initiateCheckout (same path as production)
      const checkout1 = await paymentService.initiateCheckout(userId, 'pro', 'monthly');
      const p1 = await paymentModel.findOne({ orderId: checkout1.order_id });
      createdIds.push(p1._id.toString());

      const checkout2 = await paymentService.initiateCheckout(userId, 'pro', 'monthly');
      const p2 = await paymentModel.findOne({ orderId: checkout2.order_id });
      createdIds.push(p2._id.toString());

      const result = await paymentService.getPayments(userId, 1, 10);

      expect(result.success).toBe(true);
      expect(result.payments.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });
  });

  // ──────────────── getAllPayments ────────────────

  describe('getAllPayments', () => {
    it('should get all payments with pagination', async () => {
      const result = await paymentService.getAllPayments(1, 10);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.payments)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });
  });

  // ──────────────── getPayment ────────────────

  describe('getPayment', () => {
    it('should get a payment by ID', async () => {
      const userId = new Types.ObjectId();

      const payment = await paymentModel.create({
        userId,
        orderId: `e2e-order-single-${Date.now()}`,
        planKey: 'pro',
        billingCycle: 'monthly',
        amount: 1500,
        currency: 'LKR',
        status: 'success',
      });
      createdIds.push(payment._id.toString());

      const result = await paymentService.getPayment(payment._id.toString());

      expect(result.success).toBe(true);
      expect(result.payment).toBeDefined();
      expect(result.payment.plan_key).toBe('pro');
      expect(result.payment.amount).toBe(1500);
    });

    it('should throw for non-existent payment ID', async () => {
      const fakeId = new Types.ObjectId().toString();

      await expect(
        paymentService.getPayment(fakeId),
      ).rejects.toThrow();
    });
  });
});
