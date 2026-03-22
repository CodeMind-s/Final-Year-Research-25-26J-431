import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WastePrediction } from './schemas/waste-prediction.schema';
import { JobsService } from '../jobs/jobs.service';
import { PriceEstimateService } from './price-estimate.service';
import type {
  GetWastePredictionsGrpcDto,
  GetWastePredictionsGrpcResponseDto,
  WastePredictionEntry,
  WasteAverages,
  GetWasteMonthlyPredictionsGrpcDto,
  GetWasteMonthlyPredictionsGrpcResponseDto,
  QuickPredictionGrpcDto,
  QuickPredictionGrpcResponseDto,
} from './dtos/waste-management.dto';

@Injectable()
export class WasteManagementService {
  private readonly logger = new Logger(WasteManagementService.name);

  constructor(
    @InjectModel(WastePrediction.name)
    private readonly wastePredictionModel: Model<WastePrediction>,
    private readonly jobsService: JobsService,
    private readonly priceEstimateService: PriceEstimateService
  ) {}

  async getWastePredictions(
    data: GetWastePredictionsGrpcDto
  ): Promise<GetWastePredictionsGrpcResponseDto> {
    try {
      // Set default date range: 30 days ago to 14 days in future
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const defaultStartDate = new Date(today);
      defaultStartDate.setDate(defaultStartDate.getDate() - 30);

      const defaultEndDate = new Date(today);
      defaultEndDate.setDate(defaultEndDate.getDate() + 14);

      const startDate = data.startDate
        ? new Date(data.startDate)
        : defaultStartDate;
      const endDate = data.endDate ? new Date(data.endDate) : defaultEndDate;

      // Convert dates to YYYY-MM-DD format for string comparison
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Query waste predictions within date range
      // Filter by prediction_date (YYYY-MM-DD string) and event_type
      const predictions = await this.wastePredictionModel
        .find({
          prediction_date: {
            $gte: startDateStr,
            $lte: endDateStr,
          },
          'metadata.event_type': 'WASTE/FORECAST',
        })
        .sort({ prediction_date: 1 })
        .lean();

      this.logger.log(
        `Found ${predictions.length} predictions between ${startDateStr} and ${endDateStr} with event_type WASTE/FORECAST`
      );

      // Group by date and fill missing dates with defaults
      const groupedByDate = await this.groupPredictionsByDateWithDefaults(
        predictions as unknown as WastePrediction[],
        today,
        startDate,
        endDate
      );

      // Calculate averages if requested
      const includeAverages =
        data.includeAverages !== undefined ? data.includeAverages : true;
      const averages = includeAverages
        ? this.calculateAverages(groupedByDate)
        : undefined;

      const responseData = {
        predictions: groupedByDate,
        ...(averages && { averages }),
      };

      return {
        success: true,
        data: JSON.stringify(responseData),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get waste predictions', error);
      return {
        success: false,
        data: JSON.stringify({ predictions: [] }),
        timestamp: new Date().toISOString(),
        message: error.message || 'Failed to retrieve waste predictions',
      };
    }
  }

  /**
   * Generate detailed report rows and summary for given month range (YYYY-MM)
   */
  async getPredictionReportDetailed(params: { siteId?: string; startMonth?: string; endMonth?: string; currency?: string; format?: string; }) {
    const siteId = params.siteId;
    const startMonth = params.startMonth;
    const endMonth = params.endMonth;
    const currency = params.currency || 'LKR';

    // convert months to date range
    const startDate = startMonth ? new Date(`${startMonth}-01`) : new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1);
    const endDate = endMonth ? new Date(`${endMonth}-01`) : new Date();
    // set endDate to last day of endMonth
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);

    // call existing monthly predictions generator by building a payload similar to GetWasteMonthlyPredictions
    const grpcPayload: any = { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], includeAverages: true, userId: siteId };
    const monthlyResp = await this.getWasteMonthlyPredictions(grpcPayload as any);
    const parsed = JSON.parse(monthlyResp.data || '{"predictions":[]}');
    const rows = parsed.predictions || [];

    // get prices for site
    const prices = await this.priceEstimateService.getForSite(siteId ?? undefined);

    // build detailed rows with product breakdown and incomes
    const detailedRows = rows.map((r: any) => {
      const product_breakdown: any = {};
      const products = [
        { key: 'epsom_salt', qty: r.potential_epsom_salt },
        { key: 'potash', qty: r.potential_potash },
        { key: 'magnesium_oil', qty: r.potential_magnesium_oil },
        { key: 'gypsum', qty: r.solid_waste_gypsum },
        { key: 'limestone', qty: r.solid_waste_limestone },
        { key: 'industrial_salt', qty: r.solid_waste_industrial_salt },
      ];

      let anyQty = false;
      products.forEach((p) => {
        const qty = typeof p.qty === 'number' ? p.qty : 0;
        if (qty) anyQty = true;
        const unit = prices[p.key] || 0;
        const income = parseFloat((qty * unit).toFixed(2));
        product_breakdown[p.key] = { qty: qty || null, unit_price: unit, income: qty ? income : 0 };
      });

      const valorization_potential = anyQty ? parseFloat(Object.values(product_breakdown).reduce((s: any, v: any) => s + (v.income || 0), 0).toFixed(2)) : null;

      return {
        month: r.month || r.date || r.month,
        predicted_waste: r.predicted_waste ?? null,
        production_volume: r.production_volume ?? null,
        total_solid_waste: r.total_solid_waste ?? null,
        waste_to_production_ratio_percent: r.waste_to_production_ratio_percent ?? null,
        solid_waste_percentage_percent: r.solid_waste_percentage_percent ?? null,
        valorization_potential: valorization_potential,
        product_breakdown,
      };
    });

    // compute summary totals
    const totals = detailedRows.reduce((acc: any, row: any) => {
      acc.predicted_waste += row.predicted_waste || 0;
      acc.production_volume += row.production_volume || 0;
      acc.total_solid_waste += row.total_solid_waste || 0;
      acc.valorization_potential += row.valorization_potential || 0;
      ['epsom_salt','potash','magnesium_oil','gypsum','limestone','industrial_salt'].forEach((k) => {
        acc.by_product[k].qty += (row.product_breakdown[k].qty || 0);
        acc.by_product[k].income += (row.product_breakdown[k].income || 0);
      });
      return acc;
    }, {
      predicted_waste: 0,
      production_volume: 0,
      total_solid_waste: 0,
      valorization_potential: 0,
      by_product: {
        epsom_salt: { qty: 0, income: 0 },
        potash: { qty: 0, income: 0 },
        magnesium_oil: { qty: 0, income: 0 },
        gypsum: { qty: 0, income: 0 },
        limestone: { qty: 0, income: 0 },
        industrial_salt: { qty: 0, income: 0 },
      }
    });

    // compute percentages
    const waste_to_production_ratio_percent = totals.production_volume > 0 ? parseFloat(((totals.predicted_waste / totals.production_volume) * 100).toFixed(2)) : null;
    const solid_waste_percentage_percent = totals.predicted_waste > 0 ? parseFloat(((totals.total_solid_waste / totals.predicted_waste) * 100).toFixed(2)) : null;

    const summary = {
      site_id: siteId || null,
      start_month: startMonth || null,
      end_month: endMonth || null,
      currency,
      totals: {
        predicted_waste: parseFloat(totals.predicted_waste.toFixed(2)),
        production_volume: parseFloat(totals.production_volume.toFixed(2)),
        total_solid_waste: parseFloat(totals.total_solid_waste.toFixed(2)),
        waste_to_production_ratio_percent,
        solid_waste_percentage_percent,
        valorization_potential: parseFloat(totals.valorization_potential.toFixed(2)),
      },
      by_product: totals.by_product,
    };

    return { success: true, data: { site_id: siteId || null, currency, rows: detailedRows, summary } };
  }

  async getPredictionReportSummary(params: { siteId?: string; startMonth?: string; endMonth?: string; currency?: string; }) {
    const detailed = await this.getPredictionReportDetailed({ ...params });
    return { success: true, data: detailed.data.summary };
  }

  /**
   * Get monthly aggregated waste predictions (time series by month)
   */
  async getWasteMonthlyPredictions(
    data: GetWasteMonthlyPredictionsGrpcDto
  ): Promise<GetWasteMonthlyPredictionsGrpcResponseDto> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const defaultStartDate = new Date(today);
      defaultStartDate.setFullYear(defaultStartDate.getFullYear() - 1);

      const defaultEndDate = new Date(today);
      defaultEndDate.setMonth(defaultEndDate.getMonth() + 3);

      const startDate = data.startDate ? new Date(data.startDate) : defaultStartDate;
      const endDate = data.endDate ? new Date(data.endDate) : defaultEndDate;

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      const predictions = await this.wastePredictionModel
        .find({
          prediction_date: { $gte: startStr, $lte: endStr },
          'metadata.event_type': 'WASTE/FORECAST',
        })
        .sort({ prediction_date: 1 })
        .lean();

      // Group by month YYYY-MM
      const grouped = new Map<string, any[]>();
      predictions.forEach((p) => {
        const dateStr = p.prediction_date || p.timestamp?.toISOString().split('T')[0];
        if (!dateStr) return;
        const monthKey = dateStr.substring(0, 7); // YYYY-MM
        if (!grouped.has(monthKey)) grouped.set(monthKey, []);
        grouped.get(monthKey)?.push(p);
      });

      // Generate months between start and end
      const result: any[] = [];
      const cur = new Date(startDate);
      cur.setDate(1);

      const endMonth = new Date(endDate);
      endMonth.setDate(1);

      while (cur <= endMonth) {
        const monthKey = cur.toISOString().substring(0, 7);
        const records = grouped.get(monthKey) || [];
        const monthDate = new Date(cur);
        const type = monthDate < new Date(today.getFullYear(), today.getMonth(), 1) ? 'historical' : 'predicted';

        if (records.length > 0) {
          // Sum predicted waste and production volumes, average weather
          const totalPredictedWaste = records.reduce(
            (s, r) => s + ((r.prediction_result?.Total_Waste_kg || r.forecast_result?.Total_Waste_kg) || 0),
            0
          );
          const totalProduction = records.reduce((s, r) => s + (r.input_parameters?.production_volume || 0), 0);
          const avgRain = records.reduce((s, r) => s + (r.input_parameters?.rain_sum || 0), 0) / records.length;
          const avgTemp = records.reduce((s, r) => s + (r.input_parameters?.temperature_mean || 0), 0) / records.length;
          const avgHum = records.reduce((s, r) => s + (r.input_parameters?.humidity_mean || 0), 0) / records.length;
          const avgWind = records.reduce((s, r) => s + (r.input_parameters?.wind_speed_mean || 0), 0) / records.length;

          const breakdown = this.calculateWasteBreakdown(Math.round(totalPredictedWaste));

          const row: any = {
            month: monthKey,
            predicted_waste: Math.round(totalPredictedWaste),
            production_volume: Math.round(totalProduction),
            rain_sum: parseFloat(avgRain.toFixed(2)),
            temperature_mean: parseFloat(avgTemp.toFixed(2)),
            humidity_mean: parseFloat(avgHum.toFixed(2)),
            wind_speed_mean: parseFloat(avgWind.toFixed(2)),
            type,
            ...breakdown,
          };

          // compute extra metrics (uses price estimates)
          try {
            const extra = await this.computeExtraMetrics(row as any, data.userId);
            Object.assign(row, extra);
          } catch (e) {
            this.logger.warn('Failed to compute extra metrics for month ' + monthKey, e);
          }

          result.push(row);
        } else {
          // No records: zeros/defaults
          const defaultProductionVolume = 0;
          const defaultRainSum = 0;
          const defaultTemperature = 0;
          const defaultHumidity = 0;
          const defaultWindSpeed = 0;
          const wasteRatio = 0.04 + (defaultRainSum / 10000);
          const defaultWaste = defaultProductionVolume * wasteRatio;
          const breakdown = this.calculateWasteBreakdown(Math.round(defaultWaste));

          const row: any = {
            month: monthKey,
            predicted_waste: Math.round(defaultWaste),
            production_volume: defaultProductionVolume,
            rain_sum: parseFloat(defaultRainSum.toFixed(2)),
            temperature_mean: parseFloat(defaultTemperature.toFixed(2)),
            humidity_mean: parseFloat(defaultHumidity.toFixed(2)),
            wind_speed_mean: parseFloat(defaultWindSpeed.toFixed(2)),
            type,
            ...breakdown,
          };

          try {
            const extra = await this.computeExtraMetrics(row as any, data.userId);
            Object.assign(row, extra);
          } catch (e) {
            this.logger.warn('Failed to compute extra metrics for month ' + monthKey, e);
          }

          result.push(row);
        }

        // move to next month
        cur.setMonth(cur.getMonth() + 1);
      }

      const includeAverages = data.includeAverages !== undefined ? data.includeAverages : true;
      const averages = includeAverages ? this.calculateAverages(result) : undefined;

      const responseData = {
        predictions: result,
        ...(averages && { averages }),
      };

      return {
        success: true,
        data: JSON.stringify(responseData),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get monthly waste predictions', error);
      return {
        success: false,
        data: JSON.stringify({ predictions: [] }),
        timestamp: new Date().toISOString(),
        message: error.message || 'Failed to retrieve monthly waste predictions',
      };
    }
  }

  private async groupPredictionsByDateWithDefaults(
    predictions: WastePrediction[],
    today: Date,
    startDate: Date,
    endDate: Date
  ): Promise<WastePredictionEntry[]> {
    const grouped = new Map<string, WastePrediction[]>();

    // Group existing predictions by prediction_date (already in YYYY-MM-DD format)
    predictions.forEach((pred) => {
      const dateKey = pred.prediction_date || pred.timestamp?.toISOString().split('T')[0];

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      const group = grouped.get(dateKey);
      if (group) {
        group.push(pred);
      }
    });

    // Generate all dates in the range
    const result: WastePredictionEntry[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const type = currentDate < today ? 'historical' : 'predicted';

      const records = grouped.get(dateKey);

      if (records && records.length > 0) {
        // Use actual data from database - average if multiple records
        // Support both prediction_result and forecast_result fields
        const avgPredictedWaste =
          records.reduce(
            (sum, r) => sum + ((r.prediction_result?.Total_Waste_kg || r.forecast_result?.Total_Waste_kg) || 0),
            0
          ) / records.length;
        const avgProductionVolume =
          records.reduce(
            (sum, r) => sum + (r.input_parameters?.production_volume || 0),
            0
          ) / records.length;
        const avgRainSum =
          records.reduce(
            (sum, r) => sum + (r.input_parameters?.rain_sum || 0),
            0
          ) / records.length;
        const avgTemperatureMean =
          records.reduce(
            (sum, r) => sum + (r.input_parameters?.temperature_mean || 0),
            0
          ) / records.length;
        const avgHumidityMean =
          records.reduce(
            (sum, r) => sum + (r.input_parameters?.humidity_mean || 0),
            0
          ) / records.length;
        const avgWindSpeedMean =
          records.reduce(
            (sum, r) => sum + (r.input_parameters?.wind_speed_mean || 0),
            0
          ) / records.length;

        const breakdown = this.calculateWasteBreakdown(
          Math.round(avgPredictedWaste)
        );

        const row: any = {
          date: dateKey,
          predicted_waste: Math.round(avgPredictedWaste),
          production_volume: Math.round(avgProductionVolume),
          rain_sum: parseFloat(avgRainSum.toFixed(2)),
          temperature_mean: parseFloat(avgTemperatureMean.toFixed(2)),
          humidity_mean: parseFloat(avgHumidityMean.toFixed(2)),
          wind_speed_mean: parseFloat(avgWindSpeedMean.toFixed(2)),
          type,
          ...breakdown,
        };

        try {
          const extra = await this.computeExtraMetrics(row as any);
          Object.assign(row, extra);
        } catch (e) {
          this.logger.warn('Failed to compute extra metrics for date ' + dateKey, e);
        }

        result.push(row);
      } else {
        // Use default values for missing dates
        // const defaultProductionVolume = 50000; // kg
        // const defaultRainSum = 150 + Math.random() * 100; // 150-250 mm
        // const defaultTemperature = 26 + Math.random() * 4; // 26-30°C
        // const defaultHumidity = 75 + Math.random() * 15; // 75-90%
        // const defaultWindSpeed = 10 + Math.random() * 8; // 10-18 km/h

        const defaultProductionVolume = 0; // kg
        const defaultRainSum = 0; // 150-250 mm
        const defaultTemperature = 0; // 26-30°C
        const defaultHumidity = 0; // 75-90%
        const defaultWindSpeed = 0; // 10-18 km/h

        
        // Calculate waste as ~4-5% of production volume (typical ratio)
        // Influenced by rainfall (more rain = more waste)
        const wasteRatio = 0.04 + (defaultRainSum / 10000); // 4-6.5%
        const defaultWaste = defaultProductionVolume * wasteRatio;

        const breakdown = this.calculateWasteBreakdown(
          Math.round(defaultWaste)
        );

        const row: any = {
          date: dateKey,
          predicted_waste: Math.round(defaultWaste),
          production_volume: defaultProductionVolume,
          rain_sum: parseFloat(defaultRainSum.toFixed(2)),
          temperature_mean: parseFloat(defaultTemperature.toFixed(2)),
          humidity_mean: parseFloat(defaultHumidity.toFixed(2)),
          wind_speed_mean: parseFloat(defaultWindSpeed.toFixed(2)),
          type,
          ...breakdown,
        };

        try {
          const extra = await this.computeExtraMetrics(row as any);
          Object.assign(row, extra);
        } catch (e) {
          this.logger.warn('Failed to compute extra metrics for date ' + dateKey, e);
        }

        result.push(row);
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  private calculateAverages(
    predictions: WastePredictionEntry[]
  ): WasteAverages {
    if (predictions.length === 0) {
      return {
        production_volume: 0,
        rain_sum: 0,
        temperature_mean: 0,
        humidity_mean: 0,
        wind_speed_mean: 0,
        predicted_waste: 0,
        solid_waste_gypsum: 0,
        solid_waste_limestone: 0,
        solid_waste_industrial_salt: 0,
        total_solid_waste: 0,
        liquid_waste_bittern: 0,
        potential_epsom_salt: 0,
        potential_potash: 0,
        potential_magnesium_oil: 0,
        total_liquid_waste: 0,
      };
    }

    const sum = predictions.reduce(
      (acc, pred) => ({
        production_volume: acc.production_volume + pred.production_volume,
        rain_sum: acc.rain_sum + pred.rain_sum,
        temperature_mean: acc.temperature_mean + pred.temperature_mean,
        humidity_mean: acc.humidity_mean + pred.humidity_mean,
        wind_speed_mean: acc.wind_speed_mean + pred.wind_speed_mean,
        predicted_waste: acc.predicted_waste + pred.predicted_waste,
        solid_waste_gypsum: acc.solid_waste_gypsum + pred.solid_waste_gypsum,
        solid_waste_limestone: acc.solid_waste_limestone + pred.solid_waste_limestone,
        solid_waste_industrial_salt: acc.solid_waste_industrial_salt + pred.solid_waste_industrial_salt,
        total_solid_waste: acc.total_solid_waste + pred.total_solid_waste,
        liquid_waste_bittern: acc.liquid_waste_bittern + pred.liquid_waste_bittern,
        potential_epsom_salt: acc.potential_epsom_salt + pred.potential_epsom_salt,
        potential_potash: acc.potential_potash + pred.potential_potash,
        potential_magnesium_oil: acc.potential_magnesium_oil + pred.potential_magnesium_oil,
        total_liquid_waste: acc.total_liquid_waste + pred.total_liquid_waste,
        waste_to_production_ratio_percent: acc.waste_to_production_ratio_percent + (pred.waste_to_production_ratio_percent || 0),
        solid_waste_percentage_percent: acc.solid_waste_percentage_percent + (pred.solid_waste_percentage_percent || 0),
        valorization_potential: acc.valorization_potential + (pred.valorization_potential || 0),
      }),
      {
        production_volume: 0,
        rain_sum: 0,
        temperature_mean: 0,
        humidity_mean: 0,
        wind_speed_mean: 0,
        predicted_waste: 0,
        solid_waste_gypsum: 0,
        solid_waste_limestone: 0,
        solid_waste_industrial_salt: 0,
        total_solid_waste: 0,
        liquid_waste_bittern: 0,
        potential_epsom_salt: 0,
        potential_potash: 0,
        potential_magnesium_oil: 0,
        total_liquid_waste: 0,
        waste_to_production_ratio_percent: 0,
        solid_waste_percentage_percent: 0,
        valorization_potential: 0,
      }
    );

    const count = predictions.filter((p) => p.production_volume).length || 1;

    return {
      production_volume: Math.round(sum.production_volume / count),
      rain_sum: parseFloat((sum.rain_sum / count).toFixed(2)),
      temperature_mean: parseFloat((sum.temperature_mean / count).toFixed(2)),
      humidity_mean: parseFloat((sum.humidity_mean / count).toFixed(2)),
      wind_speed_mean: parseFloat((sum.wind_speed_mean / count).toFixed(2)),
      predicted_waste: Math.round(sum.predicted_waste / count),
      solid_waste_gypsum: Math.round(sum.solid_waste_gypsum / count),
      solid_waste_limestone: Math.round(sum.solid_waste_limestone / count),
      solid_waste_industrial_salt: Math.round(sum.solid_waste_industrial_salt / count),
      total_solid_waste: Math.round(sum.total_solid_waste / count),
      liquid_waste_bittern: Math.round(sum.liquid_waste_bittern / count),
      potential_epsom_salt: Math.round(sum.potential_epsom_salt / count),
      potential_potash: Math.round(sum.potential_potash / count),
      potential_magnesium_oil: Math.round(sum.potential_magnesium_oil / count),
      total_liquid_waste: Math.round(sum.total_liquid_waste / count),
      waste_to_production_ratio_percent: parseFloat((sum.waste_to_production_ratio_percent / count).toFixed(2)),
      solid_waste_percentage_percent: parseFloat((sum.solid_waste_percentage_percent / count).toFixed(2)),
      valorization_potential: parseFloat((sum.valorization_potential / count).toFixed(2)),
    };
  }

  private async computeExtraMetrics(row: any, siteId?: string | null) {
    try {
      const prices = await this.priceEstimateService.getForSite(siteId ?? undefined);

      const waste = row.predicted_waste || 0;
      const prod = row.production_volume || 0;

      const waste_to_production_ratio_percent = prod > 0 ? parseFloat(((waste / prod) * 100).toFixed(2)) : null;
      const solid_pct = waste > 0 ? parseFloat(((row.total_solid_waste / waste) * 100).toFixed(2)) : null;

      const valorization =
        (row.potential_epsom_salt || 0) * (prices.epsom_salt || 0) +
        (row.potential_potash || 0) * (prices.potash || 0) +
        (row.potential_magnesium_oil || 0) * (prices.magnesium_oil || 0) +
        (row.solid_waste_gypsum || 0) * (prices.gypsum || 0) +
        (row.solid_waste_limestone || 0) * (prices.limestone || 0) +
        (row.solid_waste_industrial_salt || 0) * (prices.industrial_salt || 0);

      return {
        waste_to_production_ratio_percent,
        solid_waste_percentage_percent: solid_pct,
        valorization_potential: parseFloat((valorization || 0).toFixed(2)),
      };
    } catch (err) {
      this.logger.error('Error computing extra metrics', err);
      return {
        waste_to_production_ratio_percent: null,
        solid_waste_percentage_percent: null,
        valorization_potential: null,
      };
    }
  }

  /**
   * Calculate waste breakdown from total predicted waste
   * Based on typical salt production waste composition
   */
  private calculateWasteBreakdown(predictedWaste: number) {
    // Solid waste components (~60-65% of total waste)
    // Gypsum (CaSO4): ~28-30% of total waste
    const solid_waste_gypsum = Math.round(predictedWaste * 0.29);
    
    // Limestone residue (CaCO3): ~20-22% of total waste
    const solid_waste_limestone = Math.round(predictedWaste * 0.21);
    
    // Low-grade industrial salt: ~13-15% of total waste
    const solid_waste_industrial_salt = Math.round(predictedWaste * 0.14);
    
    const total_solid_waste = solid_waste_gypsum + solid_waste_limestone + solid_waste_industrial_salt;

    // Liquid waste components (~35-40% of total waste)
    // Bittern (waste brine): ~25-27% of total waste (converted to liters, density ~1.2 kg/L)
    const liquid_waste_bittern = Math.round((predictedWaste * 0.26) / 1.2);
    
    // Recoverable products from bittern
    // Epsom salt (MgSO4): ~4% of total waste
    const potential_epsom_salt = Math.round(predictedWaste * 0.04);
    
    // Potash (K2O): ~2.8% of total waste
    const potential_potash = Math.round(predictedWaste * 0.028);
    
    // Magnesium oil: ~1.5% of total waste (in liters)
    const potential_magnesium_oil = Math.round((predictedWaste * 0.015) / 1.1);
    
    const total_liquid_waste = liquid_waste_bittern + potential_epsom_salt + potential_potash + potential_magnesium_oil;

    return {
      solid_waste_gypsum,
      solid_waste_limestone,
      solid_waste_industrial_salt,
      total_solid_waste,
      liquid_waste_bittern,
      potential_epsom_salt,
      potential_potash,
      potential_magnesium_oil,
      total_liquid_waste,
    };
  }

  /**
   * Quick prediction endpoint - create async job for waste prediction
   */
  async quickPrediction(
    data: QuickPredictionGrpcDto
  ): Promise<QuickPredictionGrpcResponseDto> {
    try {
      const {
        production_volume,
        rain_sum,
        temperature_mean,
        humidity_mean,
        wind_speed_mean,
      } = data;

      // Create a job for async processing
      const jobResult = await this.jobsService.createJob({
        userId: 'system', // Can be passed from request if user context is available
        jobType: 0, // JobType.WASTE_PREDICTION
        predictionDate: new Date().toISOString().split('T')[0], // Use current date for quick predictions
        requestData: {
          production_volume,
          rain_sum,
          temperature_mean,
          humidity_mean,
          wind_speed_mean,
          prediction_type: 'quick',
        },
      });

      if (!jobResult.success || !jobResult.data) {
        throw new Error(jobResult.message || 'Failed to create prediction job');
      }

      this.logger.log(
        `Quick prediction job created: ${jobResult.data._id} for ${production_volume}kg production`
      );

      const responseData = {
        jobId: jobResult.data._id,
        status: 'PENDING',
        message: 'Prediction job created successfully. Use the jobId to check status and retrieve results.',
      };

      return {
        success: true,
        data: JSON.stringify(responseData),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to create quick prediction job', error);
      return {
        success: false,
        data: JSON.stringify({ jobId: null, status: 'FAILED' }),
        timestamp: new Date().toISOString(),
        message: error.message || 'Failed to create prediction job',
      };
    }
  }
}
