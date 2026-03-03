import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RpcException } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { PaymentService } from './payment.service';
import { PayHereService } from './payhere.service';
import { Payment } from './schemas/payment.schema';
import { status as GrpcStatus } from '@grpc/grpc-js';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentModel: any;
  let mockAuthClient: any;
  let mockAuthService: any;
  let mockPayHereService: any;

  const mockPayment = {
    _id: '507f1f77bcf86cd799439011',
    userId: '607f1f77bcf86cd799439099',
    orderId: 'test-order-uuid-001',
    planKey: 'pro',
    billingCycle: 'monthly',
    amount: 1500,
    currency: 'LKR',
    status: 'pending',
    paymentMethod: 'payhere',
    payHerePaymentId: null,
    payHereMd5Sig: null,
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z'),
    save: jest.fn(),
    toString: jest.fn().mockReturnValue('607f1f77bcf86cd799439099'),
  };

  const mockPlan = {
    key: 'pro',
    name: 'Pro Plan',
    price_monthly_lkr: 1500,
    price_annual_lkr: 15000,
  };

  const createMockPaymentModel = (mockData: any = null) => {
    const model: any = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(mockData),
    }));

    Object.assign(model, {
      create: jest.fn().mockResolvedValue(mockData),
      findOne: jest.fn().mockReturnValue(mockData),
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockData),
      }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockData ? [mockData] : []),
            }),
          }),
        }),
      }),
      countDocuments: jest.fn().mockResolvedValue(1),
    });

    return model;
  };

  beforeEach(async () => {
    mockAuthService = {
      GetPlan: jest.fn().mockReturnValue(
        of({ success: true, plan: mockPlan }),
      ),
      CreateSubscription: jest.fn().mockReturnValue(
        of({ success: true, message: 'Subscription created' }),
      ),
    };

    mockAuthClient = {
      getService: jest.fn().mockReturnValue(mockAuthService),
    };

    mockPayHereService = {
      generateCheckoutHash: jest.fn().mockReturnValue('ABCDEF1234567890ABCDEF1234567890'),
      validateNotificationHash: jest.fn().mockReturnValue(true),
    };

    paymentModel = createMockPaymentModel(mockPayment);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: 'AUTH_PACKAGE', useValue: mockAuthClient },
        { provide: PayHereService, useValue: mockPayHereService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    // Trigger onModuleInit to set up the auth service proxy
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up env overrides
    delete process.env.PAYHERE_MERCHANT_ID;
    delete process.env.PAYHERE_MERCHANT_SECRET;
    delete process.env.PAYHERE_NOTIFY_URL;
    delete process.env.FRONTEND_URL;
  });

  describe('onModuleInit', () => {
    it('should get AuthService from the gRPC client', () => {
      expect(mockAuthClient.getService).toHaveBeenCalledWith('AuthService');
    });
  });

  describe('initiateCheckout', () => {
    const userId = '607f1f77bcf86cd799439099';
    const planKey = 'pro';

    it('should get plan from auth-service, create pending payment, generate hash, and return checkout data', async () => {
      const result = await service.initiateCheckout(userId, planKey, 'monthly');

      expect(mockAuthService.GetPlan).toHaveBeenCalledWith({ plan_key: planKey });
      expect(paymentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          planKey,
          billingCycle: 'monthly',
          amount: 1500,
          currency: 'LKR',
          status: 'pending',
          paymentMethod: 'payhere',
        }),
      );
      expect(mockPayHereService.generateCheckoutHash).toHaveBeenCalledWith(
        expect.any(String), // merchantId
        expect.any(String), // orderId (UUID)
        1500,               // amount (monthly)
        'LKR',
        expect.any(String), // merchantSecret
      );
      expect(result.success).toBe(true);
      expect(result.hash).toBe('ABCDEF1234567890ABCDEF1234567890');
      expect(result.amount).toBe(1500);
      expect(result.currency).toBe('LKR');
      expect(result.items).toBe('Pro Plan - monthly');
      expect(result.merchant_id).toBeDefined();
      expect(result.order_id).toBeDefined();
      expect(result.notify_url).toBeDefined();
      expect(result.return_url).toContain('/payments/success');
      expect(result.cancel_url).toContain('/payments/cancel');
    });

    it('should use annual price when billingCycle is annual', async () => {
      const result = await service.initiateCheckout(userId, planKey, 'annual');

      expect(paymentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 15000,
          billingCycle: 'annual',
        }),
      );
      expect(mockPayHereService.generateCheckoutHash).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        15000,
        'LKR',
        expect.any(String),
      );
      expect(result.amount).toBe(15000);
      expect(result.items).toBe('Pro Plan - annual');
    });

    it('should use monthly price when billingCycle is monthly', async () => {
      const result = await service.initiateCheckout(userId, planKey, 'monthly');

      expect(paymentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1500,
          billingCycle: 'monthly',
        }),
      );
      expect(result.amount).toBe(1500);
    });

    it('should throw RpcException NOT_FOUND when plan is not found (gRPC call fails)', async () => {
      mockAuthService.GetPlan.mockReturnValue(
        throwError(() => new Error('Plan not found')),
      );

      await expect(service.initiateCheckout(userId, 'nonexistent', 'monthly'))
        .rejects.toThrow(RpcException);

      try {
        await service.initiateCheckout(userId, 'nonexistent', 'monthly');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = error.getError();
        expect(rpcError.code).toBe(GrpcStatus.NOT_FOUND);
        expect(rpcError.message).toContain("Plan 'nonexistent' not found");
      }
    });

    it('should throw RpcException NOT_FOUND when plan response indicates failure', async () => {
      mockAuthService.GetPlan.mockReturnValue(
        of({ success: false, plan: null }),
      );

      try {
        await service.initiateCheckout(userId, planKey, 'monthly');
        fail('Expected RpcException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = error.getError();
        expect(rpcError.code).toBe(GrpcStatus.NOT_FOUND);
        expect(rpcError.message).toContain("Plan 'pro' not found");
      }
    });

    it('should generate a UUID for the order ID', async () => {
      const result = await service.initiateCheckout(userId, planKey, 'monthly');

      // UUID v4 format
      expect(result.order_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('should use environment variables for merchant credentials when set', async () => {
      process.env.PAYHERE_MERCHANT_ID = 'ENV_MERCHANT';
      process.env.PAYHERE_MERCHANT_SECRET = 'ENV_SECRET';
      process.env.PAYHERE_NOTIFY_URL = 'https://example.com/notify';
      process.env.FRONTEND_URL = 'https://example.com';

      const result = await service.initiateCheckout(userId, planKey, 'monthly');

      expect(result.merchant_id).toBe('ENV_MERCHANT');
      expect(result.notify_url).toBe('https://example.com/notify');
      expect(result.return_url).toBe('https://example.com/payments/success');
      expect(result.cancel_url).toBe('https://example.com/payments/cancel');
      expect(mockPayHereService.generateCheckoutHash).toHaveBeenCalledWith(
        'ENV_MERCHANT',
        expect.any(String),
        1500,
        'LKR',
        'ENV_SECRET',
      );
    });
  });

  describe('handleNotification', () => {
    const validNotificationParams = {
      merchant_id: '1228391',
      order_id: 'test-order-uuid-001',
      payment_id: 'PH-PAY-001',
      payhere_amount: '1500.00',
      payhere_currency: 'LKR',
      status_code: '2',
      md5sig: 'VALID_HASH',
    };

    beforeEach(() => {
      // findOne returns a payment doc with save()
      const paymentDoc = {
        ...mockPayment,
        save: jest.fn().mockResolvedValue(undefined),
      };
      paymentModel.findOne.mockReturnValue(paymentDoc);
    });

    it('should update payment to success and activate subscription when status_code is 2', async () => {
      const paymentDoc = paymentModel.findOne();

      const result = await service.handleNotification(validNotificationParams);

      expect(mockPayHereService.validateNotificationHash).toHaveBeenCalledWith(
        validNotificationParams.merchant_id,
        validNotificationParams.order_id,
        validNotificationParams.payhere_amount,
        validNotificationParams.payhere_currency,
        validNotificationParams.status_code,
        validNotificationParams.md5sig,
        expect.any(String), // merchantSecret
      );
      expect(paymentDoc.status).toBe('success');
      expect(paymentDoc.payHerePaymentId).toBe('PH-PAY-001');
      expect(paymentDoc.payHereMd5Sig).toBe('VALID_HASH');
      expect(paymentDoc.save).toHaveBeenCalled();
      expect(mockAuthService.CreateSubscription).toHaveBeenCalledWith({
        user_id: paymentDoc.userId.toString(),
        plan_key: paymentDoc.planKey,
        payment_method: 'payhere',
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('success');
    });

    it('should throw RpcException PERMISSION_DENIED when hash is invalid', async () => {
      mockPayHereService.validateNotificationHash.mockReturnValue(false);

      try {
        await service.handleNotification(validNotificationParams);
        fail('Expected RpcException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = error.getError();
        expect(rpcError.code).toBe(GrpcStatus.PERMISSION_DENIED);
        expect(rpcError.message).toBe('Invalid notification hash');
      }
    });

    it('should throw RpcException NOT_FOUND when payment is not found', async () => {
      mockPayHereService.validateNotificationHash.mockReturnValue(true);
      paymentModel.findOne.mockReturnValue(null);

      try {
        await service.handleNotification(validNotificationParams);
        fail('Expected RpcException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = error.getError();
        expect(rpcError.code).toBe(GrpcStatus.NOT_FOUND);
        expect(rpcError.message).toContain('Payment not found');
      }
    });

    it('should map status_code -1 to cancelled', async () => {
      const params = { ...validNotificationParams, status_code: '-1' };
      const paymentDoc = paymentModel.findOne();

      await service.handleNotification(params);

      expect(paymentDoc.status).toBe('cancelled');
      expect(mockAuthService.CreateSubscription).not.toHaveBeenCalled();
    });

    it('should map status_code -2 to failed', async () => {
      const params = { ...validNotificationParams, status_code: '-2' };
      const paymentDoc = paymentModel.findOne();

      await service.handleNotification(params);

      expect(paymentDoc.status).toBe('failed');
      expect(mockAuthService.CreateSubscription).not.toHaveBeenCalled();
    });

    it('should map status_code -3 to failed', async () => {
      const params = { ...validNotificationParams, status_code: '-3' };
      const paymentDoc = paymentModel.findOne();

      await service.handleNotification(params);

      expect(paymentDoc.status).toBe('failed');
      expect(mockAuthService.CreateSubscription).not.toHaveBeenCalled();
    });

    it('should map status_code 0 to pending', async () => {
      const params = { ...validNotificationParams, status_code: '0' };
      const paymentDoc = paymentModel.findOne();

      await service.handleNotification(params);

      expect(paymentDoc.status).toBe('pending');
      expect(mockAuthService.CreateSubscription).not.toHaveBeenCalled();
    });

    it('should map unknown status codes to failed', async () => {
      const params = { ...validNotificationParams, status_code: '99' };
      const paymentDoc = paymentModel.findOne();

      await service.handleNotification(params);

      expect(paymentDoc.status).toBe('failed');
      expect(mockAuthService.CreateSubscription).not.toHaveBeenCalled();
    });

    it('should not throw when CreateSubscription fails (logs error instead)', async () => {
      mockAuthService.CreateSubscription.mockReturnValue(
        throwError(() => new Error('Auth service unavailable')),
      );

      // Should resolve without throwing despite subscription activation failure
      const result = await service.handleNotification(validNotificationParams);

      expect(result.success).toBe(true);
      expect(result.message).toContain('success');
    });

    it('should use env PAYHERE_MERCHANT_SECRET when set', async () => {
      process.env.PAYHERE_MERCHANT_SECRET = 'ENV_TEST_SECRET';
      const paymentDoc = paymentModel.findOne();

      await service.handleNotification(validNotificationParams);

      expect(mockPayHereService.validateNotificationHash).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'ENV_TEST_SECRET',
      );
    });
  });

  describe('getPayments', () => {
    it('should return paginated payments for a user', async () => {
      const result = await service.getPayments('607f1f77bcf86cd799439099', 1, 10);

      expect(result.success).toBe(true);
      expect(result.payments).toBeDefined();
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(paymentModel.find).toHaveBeenCalledWith({ userId: '607f1f77bcf86cd799439099' });
    });

    it('should calculate skip correctly for pagination', async () => {
      await service.getPayments('607f1f77bcf86cd799439099', 3, 5);

      const findResult = paymentModel.find({ userId: '607f1f77bcf86cd799439099' });
      const sortResult = findResult.sort({ createdAt: -1 });
      // skip should be (3-1)*5 = 10
      expect(sortResult.skip).toHaveBeenCalledWith(10);
      expect(sortResult.skip().limit).toHaveBeenCalledWith(5);
    });

    it('should transform payments using toPaymentProto format', async () => {
      const result = await service.getPayments('607f1f77bcf86cd799439099', 1, 10);

      expect(result.payments).toHaveLength(1);
      const payment = result.payments[0];
      expect(payment).toHaveProperty('id');
      expect(payment).toHaveProperty('user_id');
      expect(payment).toHaveProperty('order_id');
      expect(payment).toHaveProperty('plan_key');
      expect(payment).toHaveProperty('billing_cycle');
      expect(payment).toHaveProperty('amount');
      expect(payment).toHaveProperty('currency');
      expect(payment).toHaveProperty('status');
      expect(payment).toHaveProperty('payment_method');
      expect(payment).toHaveProperty('payhere_payment_id');
    });
  });

  describe('getAllPayments', () => {
    it('should return paginated payments for all users', async () => {
      const result = await service.getAllPayments(1, 10);

      expect(result.success).toBe(true);
      expect(result.payments).toBeDefined();
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(paymentModel.find).toHaveBeenCalledWith();
    });

    it('should calculate skip correctly for page 2', async () => {
      await service.getAllPayments(2, 20);

      const findResult = paymentModel.find();
      const sortResult = findResult.sort({ createdAt: -1 });
      expect(sortResult.skip).toHaveBeenCalledWith(20); // (2-1)*20
      expect(sortResult.skip().limit).toHaveBeenCalledWith(20);
    });
  });

  describe('getPayment', () => {
    it('should return a single payment by id', async () => {
      const result = await service.getPayment('507f1f77bcf86cd799439011');

      expect(result.success).toBe(true);
      expect(result.payment).toBeDefined();
      expect(result.payment.id).toBe('507f1f77bcf86cd799439011');
      expect(paymentModel.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw RpcException NOT_FOUND when payment does not exist', async () => {
      paymentModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      try {
        await service.getPayment('nonexistent-id');
        fail('Expected RpcException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = error.getError();
        expect(rpcError.code).toBe(GrpcStatus.NOT_FOUND);
        expect(rpcError.message).toContain('Payment nonexistent-id not found');
      }
    });

    it('should return payment with proto-formatted timestamps', async () => {
      const result = await service.getPayment('507f1f77bcf86cd799439011');

      expect(result.payment.created_at).toBeDefined();
      expect(result.payment.created_at).toHaveProperty('seconds');
      expect(result.payment.created_at).toHaveProperty('nanos', 0);
      expect(result.payment.updated_at).toBeDefined();
    });

    it('should return empty string for payhere_payment_id when null', async () => {
      const result = await service.getPayment('507f1f77bcf86cd799439011');

      expect(result.payment.payhere_payment_id).toBe('');
    });
  });
});
