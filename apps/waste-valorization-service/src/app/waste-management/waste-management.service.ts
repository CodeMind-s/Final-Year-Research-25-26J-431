import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WastePrediction } from './schemas/waste-prediction.schema';
import { JobsService } from '../jobs/jobs.service';
import type {
  GetWastePredictionsGrpcDto,
  GetWastePredictionsGrpcResponseDto,
  WastePredictionEntry,
  WasteAverages,
  QuickPredictionGrpcDto,
  QuickPredictionGrpcResponseDto,
} from './dtos/waste-management.dto';

@Injectable()
export class WasteManagementService {
  private readonly logger = new Logger(WasteManagementService.name);

  constructor(
    @InjectModel(WastePrediction.name)
    private readonly wastePredictionModel: Model<WastePrediction>,
    private readonly jobsService: JobsService
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

      console.log(`Queried waste predictions from ${startDateStr} to ${endDateStr}`);
      console.log(predictions);

      this.logger.log(
        `Found ${predictions.length} predictions between ${startDateStr} and ${endDateStr} with event_type WASTE/FORECAST`
      );

      // Group by date and fill missing dates with defaults
      const groupedByDate = this.groupPredictionsByDateWithDefaults(
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

  private groupPredictionsByDateWithDefaults(
    predictions: WastePrediction[],
    today: Date,
    startDate: Date,
    endDate: Date
  ): WastePredictionEntry[] {
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

        result.push({
          date: dateKey,
          predicted_waste: Math.round(avgPredictedWaste),
          production_volume: Math.round(avgProductionVolume),
          rain_sum: parseFloat(avgRainSum.toFixed(2)),
          temperature_mean: parseFloat(avgTemperatureMean.toFixed(2)),
          humidity_mean: parseFloat(avgHumidityMean.toFixed(2)),
          wind_speed_mean: parseFloat(avgWindSpeedMean.toFixed(2)),
          type,
          ...breakdown,
        });
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

        result.push({
          date: dateKey,
          predicted_waste: Math.round(defaultWaste),
          production_volume: defaultProductionVolume,
          rain_sum: parseFloat(defaultRainSum.toFixed(2)),
          temperature_mean: parseFloat(defaultTemperature.toFixed(2)),
          humidity_mean: parseFloat(defaultHumidity.toFixed(2)),
          wind_speed_mean: parseFloat(defaultWindSpeed.toFixed(2)),
          type,
          ...breakdown,
        });
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
      }
    );

    const count = predictions.length;

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
    };
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
