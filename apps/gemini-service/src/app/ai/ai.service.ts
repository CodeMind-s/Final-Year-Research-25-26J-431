import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Microservices from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import axios from 'axios';

interface WeatherForecastResponse {
  success: boolean;
  message: string;
  data: string | any;
}

interface CrystallizationService {
  GetWeatherForecast(data: {
    lat?: number;
    lon?: number;
    cnt?: number;
  }): Observable<WeatherForecastResponse>;
}

interface WeatherNotificationResult {
  notification: {
    si: string;
    ta: string;
    en: string;
  };
  description: {
    si: string;
    ta: string;
    en: string;
  };
  plandays: number;
  startdate: string;
}

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private readonly geminiApiKey: string;
  private readonly geminiApiUrl =
    'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent';
  private crystallizationService: CrystallizationService;

  constructor(
    private readonly configService: ConfigService,
    @Inject('CRYSTALLIZATION_PACKAGE') private crystallizationClient: Microservices.ClientGrpc
  ) {
    // Using provided API key, can also be moved to environment variable
    this.geminiApiKey =
      this.configService.get<string>('GEMINI_API_KEY') ||
      'AIzaSyDr0Fx4OfpUAAtxB4rr-4LWr-67f7Cqp78';
  }

  onModuleInit() {
    this.crystallizationService =
      this.crystallizationClient.getService<CrystallizationService>(
        'CrystallizationService'
      );
  }

  /**
   * Generate weather notification with harvest planning recommendation
   * using Gemini AI based on weather forecast data
   */
  async getWeatherNotification(): Promise<WeatherNotificationResult> {
    try {
      // Step 1: Fetch weather forecast from crystallization service
      this.logger.log('Fetching weather forecast from crystallization service');
      const weatherForecast = await firstValueFrom(
        this.crystallizationService.GetWeatherForecast({
          lat: 8.061542, // Sri Lanka Puttalam coordinates
          lon: 79.814714,
          cnt: 16, // 16 days forecast
        })
      );

      if (!weatherForecast.success) {
        throw new Error('Failed to fetch weather forecast');
      }

      this.logger.log('Weather forecast fetched successfully');

      // Step 2: Parse weather data
      const weatherData =
        typeof weatherForecast.data === 'string'
          ? JSON.parse(weatherForecast.data)
          : weatherForecast.data;

      // Step 3: Build prompt for Gemini AI
      const prompt = this.buildGeminiPrompt(weatherData);

      // Step 4: Call Gemini AI API
      this.logger.log('Calling Gemini AI for analysis');
      const geminiResponse = await this.callGeminiApi(prompt);

      // Step 5: Parse Gemini response and return formatted result
      return this.parseGeminiResponse(geminiResponse);
    } catch (error) {
      this.logger.error(
        `Error in getWeatherNotification: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Build a structured prompt for Gemini AI to analyze weather and provide harvest planning advice
   */
  private buildGeminiPrompt(weatherData: any): string {
    const currentDate = new Date().toISOString().split('T')[0];

    // Extract relevant weather information
    const forecast = weatherData.list || [];
    const cityName = weatherData.city?.name || 'Unknown Location';

    // Summarize weather conditions
    const weatherSummary = forecast
      .slice(0, 16)
      .map((day: any, index: number) => {
        const date = new Date(day.dt * 1000).toISOString().split('T')[0];
        const temp = day.temp?.day || day.main?.temp || 0;
        const weather = day.weather?.[0]?.main || 'Unknown';
        const description = day.weather?.[0]?.description || '';
        const humidity = day.humidity || 0;
        const rain = day.rain || 0;

        return `Day ${
          index + 1
        } (${date}): ${weather} - ${description}, Temp: ${(
          temp - 273.15
        ).toFixed(1)}°C, Humidity: ${humidity}%, Rain: ${rain}mm`;
      })
      .join('\n');

    const prompt = `You are an expert agricultural advisor specializing in salt production planning in Sri Lanka. 
Analyze the following 16-day weather forecast for ${cityName} and provide harvest planning recommendations for salt production.

Current Date: ${currentDate}
Weather Forecast:
${weatherSummary}

Based on this weather data, provide a JSON response with the following structure:
{
  "notification": {
    "si": "Short notification in Sinhala (max 8 words)",
    "ta": "Short notification in Tamil (max 8 words)",
    "en": "Short notification in English (max 8 words)"
  },
  "description": {
    "si": "Brief explanation in Sinhala (max 20 words)",
    "ta": "Brief explanation in Tamil (max 20 words)",
    "en": "Brief explanation in English (max 20 words)"
  },
  "plandays": 30 or 45,
  "startdate": "YYYY-MM-DD format (after ${currentDate})"
}

Respond ONLY with valid JSON. No markdown. Keep all text VERY short.`;

    return prompt;
  }

  /**
   * Call Gemini AI API with the constructed prompt
   */
  private async callGeminiApi(prompt: string): Promise<any> {
    try {
      const url = `${this.geminiApiUrl}?key=${this.geminiApiKey}`;

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
        },
      };

      this.logger.log('Sending request to Gemini API');
      const response = await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (
        !response.data ||
        !response.data.candidates ||
        response.data.candidates.length === 0
      ) {
        throw new Error('Invalid response from Gemini API');
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Gemini API error: ${error.response?.status} - ${
            error.response?.data?.error?.message || error.message
          }`
        );
        throw new Error(
          `Gemini API request failed: ${
            error.response?.data?.error?.message || error.message
          }`
        );
      }
      throw error;
    }
  }

  /**
   * Parse Gemini AI response and extract the JSON recommendation
   */
  private parseGeminiResponse(geminiResponse: any): WeatherNotificationResult {
    try {
      const candidate = geminiResponse.candidates[0];
      const content = candidate.content;
      const finishReason = candidate.finishReason;

      // Check why the response finished
      if (finishReason && finishReason !== 'STOP') {
        this.logger.warn(
          `Gemini response finished with reason: ${finishReason}`
        );
      }

      // Combine all parts in case response is split
      const text = content.parts.map((part: any) => part.text).join('');

      this.logger.log(
        `Gemini response received (${text.length} chars, finishReason: ${finishReason})`
      );

      // Try to extract JSON from the response
      // Gemini might wrap it in markdown code blocks
      let jsonText = text.trim();

      // Remove markdown code block markers if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/g, '').replace(/\s*```$/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/g, '').replace(/\s*```$/g, '');
      }

      jsonText = jsonText.trim();

      this.logger.debug(`Attempting to parse ${jsonText.length} chars of JSON`);

      // Parse the JSON
      const recommendation = JSON.parse(jsonText);

      // Validate required fields
      if (
        !recommendation.notification ||
        !recommendation.notification.si ||
        !recommendation.notification.ta ||
        !recommendation.notification.en ||
        !recommendation.description ||
        !recommendation.description.si ||
        !recommendation.description.ta ||
        !recommendation.description.en ||
        !recommendation.plandays ||
        !recommendation.startdate
      ) {
        throw new Error('Missing required fields in Gemini response');
      }

      // Validate plandays is either 30 or 45
      if (![30, 45].includes(recommendation.plandays)) {
        this.logger.warn(
          `Invalid plandays value: ${recommendation.plandays}, defaulting to 45`
        );
        recommendation.plandays = 45;
      }

      // Validate startdate is a future date
      const startDate = new Date(recommendation.startdate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDate <= today) {
        this.logger.warn(
          `Start date ${recommendation.startdate} is not in the future, adjusting`
        );
        // Add one day to make it future
        startDate.setDate(today.getDate() + 1);
        recommendation.startdate = startDate.toISOString().split('T')[0];
      }

      return {
        notification: recommendation.notification,
        description: recommendation.description,
        plandays: recommendation.plandays,
        startdate: recommendation.startdate,
      };
    } catch (error) {
      // Log the actual response for debugging
      try {
        const candidate = geminiResponse.candidates[0];
        const content = candidate.content;
        const fullText = content.parts.map((part: any) => part.text).join('');
        this.logger.error(
          `Full Gemini response that failed to parse (${fullText.length} chars): ${fullText}`
        );
      } catch (logError) {
        this.logger.error(
          `Could not extract response for logging: ${logError.message}`
        );
      }
      this.logger.error(`Failed to parse Gemini response: ${error.message}`);
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }
}
