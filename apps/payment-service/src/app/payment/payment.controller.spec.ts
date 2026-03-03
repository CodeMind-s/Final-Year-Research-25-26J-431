import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('PaymentController', () => {
  let controller: PaymentController;
  let mockPaymentService: any;

  const mockCheckoutResponse = {
    success: true,
    merchant_id: '1228391',
    order_id: 'test-order-001',
    hash: 'ABCDEF1234567890',
    amount: 1500,
    currency: 'LKR',
    items: 'Pro Plan - monthly',
    notify_url: 'https://example.com/notify',
    return_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
  };

  const mockNotificationResponse = {
    success: true,
    message: 'Payment status updated to success',
  };

  const mockPaymentsResponse = {
    success: true,
    payments: [
      {
        id: '507f1f77bcf86cd799439011',
        user_id: '607f1f77bcf86cd799439099',
        order_id: 'test-order-001',
        plan_key: 'pro',
        billing_cycle: 'monthly',
        amount: 1500,
        currency: 'LKR',
        status: 'success',
        payment_method: 'payhere',
        payhere_payment_id: 'PH-001',
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
  };

  const mockSinglePaymentResponse = {
    success: true,
    payment: {
      id: '507f1f77bcf86cd799439011',
      user_id: '607f1f77bcf86cd799439099',
      order_id: 'test-order-001',
      plan_key: 'pro',
      billing_cycle: 'monthly',
      amount: 1500,
      currency: 'LKR',
      status: 'success',
      payment_method: 'payhere',
      payhere_payment_id: 'PH-001',
    },
  };

  beforeEach(async () => {
    mockPaymentService = {
      initiateCheckout: jest.fn().mockResolvedValue(mockCheckoutResponse),
      handleNotification: jest.fn().mockResolvedValue(mockNotificationResponse),
      getPayments: jest.fn().mockResolvedValue(mockPaymentsResponse),
      getAllPayments: jest.fn().mockResolvedValue(mockPaymentsResponse),
      getPayment: jest.fn().mockResolvedValue(mockSinglePaymentResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: PaymentService, useValue: mockPaymentService },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('InitiateCheckout', () => {
    it('should delegate to paymentService.initiateCheckout with correct params', async () => {
      const data = {
        user_id: '607f1f77bcf86cd799439099',
        plan_key: 'pro',
        billing_cycle: 'monthly',
      };

      const result = await controller.InitiateCheckout(data);

      expect(mockPaymentService.initiateCheckout).toHaveBeenCalledWith(
        '607f1f77bcf86cd799439099',
        'pro',
        'monthly',
      );
      expect(result).toEqual(mockCheckoutResponse);
    });

    it('should pass through all billing cycle values', async () => {
      const data = {
        user_id: 'user-123',
        plan_key: 'lab',
        billing_cycle: 'annual',
      };

      await controller.InitiateCheckout(data);

      expect(mockPaymentService.initiateCheckout).toHaveBeenCalledWith(
        'user-123',
        'lab',
        'annual',
      );
    });
  });

  describe('HandleNotification', () => {
    it('should delegate to paymentService.handleNotification with the full data object', async () => {
      const data = {
        merchant_id: '1228391',
        order_id: 'test-order-001',
        payment_id: 'PH-PAY-001',
        payhere_amount: '1500.00',
        payhere_currency: 'LKR',
        status_code: '2',
        md5sig: 'VALID_HASH',
      };

      const result = await controller.HandleNotification(data);

      expect(mockPaymentService.handleNotification).toHaveBeenCalledWith(data);
      expect(result).toEqual(mockNotificationResponse);
    });

    it('should pass notification data exactly as received', async () => {
      const data = {
        merchant_id: '9999',
        order_id: 'order-xyz',
        payment_id: 'pay-abc',
        payhere_amount: '99.99',
        payhere_currency: 'USD',
        status_code: '-1',
        md5sig: 'some_hash',
      };

      await controller.HandleNotification(data);

      expect(mockPaymentService.handleNotification).toHaveBeenCalledWith(data);
    });
  });

  describe('GetPayments', () => {
    it('should delegate to paymentService.getPayments with correct params', async () => {
      const data = { user_id: 'user-123', page: 2, limit: 5 };

      const result = await controller.GetPayments(data);

      expect(mockPaymentService.getPayments).toHaveBeenCalledWith('user-123', 2, 5);
      expect(result).toEqual(mockPaymentsResponse);
    });

    it('should default page to 1 when not provided', async () => {
      const data = { user_id: 'user-123', page: 0, limit: 10 };

      await controller.GetPayments(data);

      // page = 0 is falsy, so it defaults to 1
      expect(mockPaymentService.getPayments).toHaveBeenCalledWith('user-123', 1, 10);
    });

    it('should default limit to 10 when not provided', async () => {
      const data = { user_id: 'user-123', page: 1, limit: 0 };

      await controller.GetPayments(data);

      // limit = 0 is falsy, so it defaults to 10
      expect(mockPaymentService.getPayments).toHaveBeenCalledWith('user-123', 1, 10);
    });

    it('should default both page and limit when not provided', async () => {
      const data = { user_id: 'user-123', page: 0, limit: 0 };

      await controller.GetPayments(data);

      expect(mockPaymentService.getPayments).toHaveBeenCalledWith('user-123', 1, 10);
    });
  });

  describe('GetPayment', () => {
    it('should delegate to paymentService.getPayment with the id', async () => {
      const data = { id: '507f1f77bcf86cd799439011' };

      const result = await controller.GetPayment(data);

      expect(mockPaymentService.getPayment).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockSinglePaymentResponse);
    });
  });

  describe('GetAllPayments', () => {
    it('should delegate to paymentService.getAllPayments with correct params', async () => {
      const data = { page: 3, limit: 20 };

      const result = await controller.GetAllPayments(data);

      expect(mockPaymentService.getAllPayments).toHaveBeenCalledWith(3, 20);
      expect(result).toEqual(mockPaymentsResponse);
    });

    it('should default page to 1 when not provided', async () => {
      const data = { page: 0, limit: 15 };

      await controller.GetAllPayments(data);

      expect(mockPaymentService.getAllPayments).toHaveBeenCalledWith(1, 15);
    });

    it('should default limit to 10 when not provided', async () => {
      const data = { page: 2, limit: 0 };

      await controller.GetAllPayments(data);

      expect(mockPaymentService.getAllPayments).toHaveBeenCalledWith(2, 10);
    });

    it('should default both page and limit when not provided', async () => {
      const data = { page: 0, limit: 0 };

      await controller.GetAllPayments(data);

      expect(mockPaymentService.getAllPayments).toHaveBeenCalledWith(1, 10);
    });
  });
});
