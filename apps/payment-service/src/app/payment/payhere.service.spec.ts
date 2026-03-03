import { PayHereService } from './payhere.service';
import { createHash } from 'crypto';

describe('PayHereService', () => {
  let service: PayHereService;

  beforeEach(() => {
    service = new PayHereService();
  });

  describe('generateCheckoutHash', () => {
    const merchantId = '1228391';
    const orderId = 'test-order-001';
    const currency = 'LKR';
    const merchantSecret = 'TestMerchantSecret123';

    it('should generate a deterministic MD5 hash for known inputs', () => {
      const amount = 1500;

      // Manually compute the expected hash:
      // step 1: MD5(merchantSecret).toUpperCase()
      const hashedSecret = createHash('md5')
        .update(merchantSecret)
        .digest('hex')
        .toUpperCase();
      // step 2: MD5(merchantId + orderId + amount.toFixed(2) + currency + hashedSecret).toUpperCase()
      const expected = createHash('md5')
        .update(merchantId + orderId + '1500.00' + currency + hashedSecret)
        .digest('hex')
        .toUpperCase();

      const result = service.generateCheckoutHash(
        merchantId,
        orderId,
        amount,
        currency,
        merchantSecret,
      );

      expect(result).toBe(expected);
    });

    it('should format amount to 2 decimal places', () => {
      // 1500 should be formatted as "1500.00"
      // 1500.5 should be formatted as "1500.50"
      const hash1 = service.generateCheckoutHash(merchantId, orderId, 1500, currency, merchantSecret);
      const hash2 = service.generateCheckoutHash(merchantId, orderId, 1500.0, currency, merchantSecret);

      // Same numeric value, same hash
      expect(hash1).toBe(hash2);

      // Different amount gives different hash
      const hash3 = service.generateCheckoutHash(merchantId, orderId, 1500.01, currency, merchantSecret);
      expect(hash1).not.toBe(hash3);
    });

    it('should produce an uppercase hex string', () => {
      const result = service.generateCheckoutHash(merchantId, orderId, 1000, currency, merchantSecret);

      // MD5 produces a 32-char hex string
      expect(result).toMatch(/^[0-9A-F]{32}$/);
    });

    it('should produce different hashes for different order IDs', () => {
      const hash1 = service.generateCheckoutHash(merchantId, 'order-aaa', 1000, currency, merchantSecret);
      const hash2 = service.generateCheckoutHash(merchantId, 'order-bbb', 1000, currency, merchantSecret);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different merchant IDs', () => {
      const hash1 = service.generateCheckoutHash('111', orderId, 1000, currency, merchantSecret);
      const hash2 = service.generateCheckoutHash('222', orderId, 1000, currency, merchantSecret);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different currencies', () => {
      const hash1 = service.generateCheckoutHash(merchantId, orderId, 1000, 'LKR', merchantSecret);
      const hash2 = service.generateCheckoutHash(merchantId, orderId, 1000, 'USD', merchantSecret);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different merchant secrets', () => {
      const hash1 = service.generateCheckoutHash(merchantId, orderId, 1000, currency, 'SecretA');
      const hash2 = service.generateCheckoutHash(merchantId, orderId, 1000, currency, 'SecretB');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle fractional amounts with proper formatting', () => {
      // 99.9 -> "99.90", 99.99 -> "99.99"
      const hash1 = service.generateCheckoutHash(merchantId, orderId, 99.9, currency, merchantSecret);
      const hash2 = service.generateCheckoutHash(merchantId, orderId, 99.90, currency, merchantSecret);

      expect(hash1).toBe(hash2);
    });
  });

  describe('validateNotificationHash', () => {
    const merchantId = '1228391';
    const orderId = 'test-order-001';
    const payhereAmount = '1500.00';
    const payhereCurrency = 'LKR';
    const statusCode = '2';
    const merchantSecret = 'TestMerchantSecret123';

    // Pre-compute a valid md5sig for these params
    function computeValidSig(): string {
      const hashedSecret = createHash('md5')
        .update(merchantSecret)
        .digest('hex')
        .toUpperCase();
      return createHash('md5')
        .update(merchantId + orderId + payhereAmount + payhereCurrency + statusCode + hashedSecret)
        .digest('hex')
        .toUpperCase();
    }

    it('should return true for a valid notification signature', () => {
      const validSig = computeValidSig();

      const result = service.validateNotificationHash(
        merchantId,
        orderId,
        payhereAmount,
        payhereCurrency,
        statusCode,
        validSig,
        merchantSecret,
      );

      expect(result).toBe(true);
    });

    it('should return false for a tampered signature', () => {
      const tamperedSig = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

      const result = service.validateNotificationHash(
        merchantId,
        orderId,
        payhereAmount,
        payhereCurrency,
        statusCode,
        tamperedSig,
        merchantSecret,
      );

      expect(result).toBe(false);
    });

    it('should perform case-insensitive comparison on md5sig', () => {
      const validSig = computeValidSig();
      const lowerSig = validSig.toLowerCase();

      const result = service.validateNotificationHash(
        merchantId,
        orderId,
        payhereAmount,
        payhereCurrency,
        statusCode,
        lowerSig,
        merchantSecret,
      );

      expect(result).toBe(true);
    });

    it('should return false when merchant_id is tampered', () => {
      const validSig = computeValidSig();

      const result = service.validateNotificationHash(
        '9999999',
        orderId,
        payhereAmount,
        payhereCurrency,
        statusCode,
        validSig,
        merchantSecret,
      );

      expect(result).toBe(false);
    });

    it('should return false when order_id is tampered', () => {
      const validSig = computeValidSig();

      const result = service.validateNotificationHash(
        merchantId,
        'tampered-order-id',
        payhereAmount,
        payhereCurrency,
        statusCode,
        validSig,
        merchantSecret,
      );

      expect(result).toBe(false);
    });

    it('should return false when amount is tampered', () => {
      const validSig = computeValidSig();

      const result = service.validateNotificationHash(
        merchantId,
        orderId,
        '9999.99',
        payhereCurrency,
        statusCode,
        validSig,
        merchantSecret,
      );

      expect(result).toBe(false);
    });

    it('should return false when status_code is tampered', () => {
      const validSig = computeValidSig();

      const result = service.validateNotificationHash(
        merchantId,
        orderId,
        payhereAmount,
        payhereCurrency,
        '-1',
        validSig,
        merchantSecret,
      );

      expect(result).toBe(false);
    });

    it('should validate correctly with different status codes', () => {
      // Compute hash for status_code = '0' (pending)
      const hashedSecret = createHash('md5')
        .update(merchantSecret)
        .digest('hex')
        .toUpperCase();
      const pendingSig = createHash('md5')
        .update(merchantId + orderId + payhereAmount + payhereCurrency + '0' + hashedSecret)
        .digest('hex')
        .toUpperCase();

      const result = service.validateNotificationHash(
        merchantId,
        orderId,
        payhereAmount,
        payhereCurrency,
        '0',
        pendingSig,
        merchantSecret,
      );

      expect(result).toBe(true);
    });
  });
});
