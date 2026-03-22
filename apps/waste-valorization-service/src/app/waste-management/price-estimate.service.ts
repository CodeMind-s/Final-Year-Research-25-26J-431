import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PriceEstimate } from './schemas/price-estimate.schema';

const DEFAULT_PRICES = {
  epsom_salt: 0,
  potash: 0,
  magnesium_oil: 0,
  gypsum: 0,
  limestone: 0,
  industrial_salt: 0,
};
const DEFAULT_CURRENCY = 'LKR';
// include currency in default prices so responses are consistent
DEFAULT_PRICES['currency'] = DEFAULT_CURRENCY;

@Injectable()
export class PriceEstimateService {
  private readonly logger = new Logger(PriceEstimateService.name);

  constructor(@InjectModel(PriceEstimate.name) private priceModel: Model<PriceEstimate>) {}

  async getForSite(siteId?: string) {
    try {
      if (!siteId) return DEFAULT_PRICES;
      const row = await this.priceModel.findOne({ site_id: siteId }).sort({ updatedAt: -1 }).lean();
      if (!row) return DEFAULT_PRICES;
      return {
        epsom_salt: row.epsom_salt ?? DEFAULT_PRICES.epsom_salt,
        potash: row.potash ?? DEFAULT_PRICES.potash,
        magnesium_oil: row.magnesium_oil ?? DEFAULT_PRICES.magnesium_oil,
        gypsum: row.gypsum ?? DEFAULT_PRICES.gypsum,
        limestone: row.limestone ?? DEFAULT_PRICES.limestone,
        industrial_salt: row.industrial_salt ?? DEFAULT_PRICES.industrial_salt,
        currency: row.currency ?? DEFAULT_CURRENCY,
      };
    } catch (err) {
      this.logger.error('Failed to get price estimates', err);
      return DEFAULT_PRICES;
    }
  }

  async upsertForSite(siteId: string | null, userId: string | null, payload: Partial<Record<string, any>>) {
    try {
      const query = siteId ? { site_id: siteId } : { site_id: null };
      const existing = await this.priceModel.findOne(query).lean();
      if (existing) {
        await this.priceModel.updateOne({ _id: existing._id }, { $set: { ...payload, user_id: userId, updatedAt: new Date() } });
        return this.getForSite(siteId ?? undefined);
      }

      const insert = {
        site_id: siteId ?? null,
        user_id: userId ?? null,
        epsom_salt: payload.epsom_salt ?? null,
        potash: payload.potash ?? null,
        magnesium_oil: payload.magnesium_oil ?? null,
        gypsum: payload.gypsum ?? null,
        limestone: payload.limestone ?? null,
        industrial_salt: payload.industrial_salt ?? null,
        currency: payload.currency ?? DEFAULT_CURRENCY,
      };
      await this.priceModel.create(insert as any);
      return this.getForSite(siteId ?? undefined);
    } catch (err) {
      this.logger.error('Failed to upsert price estimates', err);
      throw err;
    }
  }
}
