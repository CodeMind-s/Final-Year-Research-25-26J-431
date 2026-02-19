import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class PayHereService {
  /**
   * Generate the MD5 hash required for PayHere checkout form.
   * Formula: MD5(merchant_id + order_id + amount_formatted + currency + MD5(merchant_secret))
   */
  generateCheckoutHash(
    merchantId: string,
    orderId: string,
    amount: number,
    currency: string,
    merchantSecret: string,
  ): string {
    const amountFormatted = amount.toFixed(2);
    const hashedSecret = createHash('md5')
      .update(merchantSecret)
      .digest('hex')
      .toUpperCase();

    const hash = createHash('md5')
      .update(merchantId + orderId + amountFormatted + currency + hashedSecret)
      .digest('hex')
      .toUpperCase();

    return hash;
  }

  /**
   * Validate the MD5 signature from PayHere notification webhook.
   * Formula: MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + MD5(merchant_secret))
   */
  validateNotificationHash(
    merchantId: string,
    orderId: string,
    payhereAmount: string,
    payhereCurrency: string,
    statusCode: string,
    md5sig: string,
    merchantSecret: string,
  ): boolean {
    const hashedSecret = createHash('md5')
      .update(merchantSecret)
      .digest('hex')
      .toUpperCase();

    const expectedHash = createHash('md5')
      .update(
        merchantId + orderId + payhereAmount + payhereCurrency + statusCode + hashedSecret,
      )
      .digest('hex')
      .toUpperCase();

    return expectedHash === md5sig.toUpperCase();
  }
}
