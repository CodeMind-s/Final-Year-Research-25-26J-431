# AI Service

A microservice that integrates with Google's Gemini AI to provide intelligent weather-based harvest planning recommendations for salt production.

## Overview

The AI Service analyzes weather forecast data and generates actionable recommendations for salt harvest planning using Google's Gemini AI model. It communicates with the Crystallization Service to fetch weather data and provides recommendations through gRPC.

## Features

- 🤖 **Gemini AI Integration**: Leverages Google's Gemini Pro model for intelligent analysis
- 🌤️ **Weather Analysis**: Processes 16-day weather forecasts
- 📊 **Harvest Planning**: Generates recommendations for optimal harvest timing
- 🔄 **gRPC Communication**: Efficient communication with other microservices
- 📝 **Structured Responses**: Returns JSON-formatted recommendations

## Architecture

### Communication Flow
```
API Gateway → AI Service (gRPC) → Crystallization Service (gRPC) → OpenWeather API
                    ↓
              Gemini AI API
                    ↓
              Recommendations
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GRPC_URL` | gRPC server URL | `0.0.0.0:50059` | Yes |
| `CRYSTALLIZATION_SERVICE_URL` | Crystallization service endpoint | `crystallization-service:50054` | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | - | Yes |

### Port

- **gRPC**: 50059

## API Reference

### gRPC Service: `AiService`

#### `GetWeatherNotification`

Generates a weather-based notification and harvest planning recommendation.

**Request**: `GetWeatherNotificationRequest` (empty)

**Response**: `GetWeatherNotificationResponse`
```protobuf
message GetWeatherNotificationResponse {
  bool success = 1;
  string message = 2;
  string notification = 3;        // Short notification (e.g., "Hold for ~4 weeks")
  string description = 4;         // Detailed explanation
  int32 plandays = 5;            // Plan duration: 30 or 45 days
  string startdate = 6;          // Recommended start date (YYYY-MM-DD)
}
```

## Response Example

```json
{
  "success": true,
  "message": "Weather notification generated successfully",
  "notification": "Hold for ~4 weeks",
  "description": "Weather is trending rainy over the next 2 weeks with high humidity levels. Waiting until early April could provide better conditions for salt crystallization with more consecutive dry days expected.",
  "plandays": 45,
  "startdate": "2026-04-05"
}
```

## AI Decision Factors

The Gemini AI model considers the following factors when generating recommendations:

1. **Rainfall**: Direct impact on salt crystallization and harvest operations
2. **Humidity**: Affects evaporation rates
3. **Temperature**: Optimal range is 25-35°C for salt production
4. **Consecutive Dry Days**: Preferred for successful harvest
5. **Seasonal Patterns**: Long-term weather trends

## Recommendation Guidelines

- **30-day plan**: Favorable weather conditions with minimal rain expected
- **45-day plan**: Less favorable conditions requiring extended preparation time
- **Start date**: Always set to a future date after current date

## Development

### Build
```bash
nx build gemini-service
```

### Run Locally
```bash
# Set environment variables
export GRPC_URL=0.0.0.0:50059
export CRYSTALLIZATION_SERVICE_URL=localhost:50054
export GEMINI_API_KEY=your_api_key_here

# Run the service
node dist/apps/gemini-service/main.js
```

### Docker Build
```bash
docker build -f Dockerfile --build-arg SERVICE_NAME=gemini-service -t gemini-service .
```

## Dependencies

- **@nestjs/core**: NestJS framework
- **@nestjs/microservices**: gRPC support
- **@nestjs/config**: Configuration management
- **axios**: HTTP client for Gemini API
- **rxjs**: Reactive programming

## Integration with API Gateway

The API Gateway exposes this service through a REST endpoint:

**Endpoint**: `GET /ai/weather-notification`

**Authorization**: Requires JWT token with `LANDOWNER` or `SALTSOCIETY` role

**Response**:
```json
{
  "notification": "Hold for ~4 weeks",
  "description": "Weather analysis details...",
  "plandays": 45,
  "startdate": "2026-04-05"
}
```

## Error Handling

- **Connection Failures**: Returns error response with fallback values
- **API Errors**: Logs detailed error messages and propagates to caller
- **Invalid AI Responses**: Validates and corrects malformed responses
- **Weather Service Unavailable**: Gracefully handles service outages

## Monitoring

The service logs important events:
- Weather data fetch operations
- Gemini API requests and responses
- Error conditions and warnings
- Response validation and corrections

## Security Considerations

- API keys should be stored in environment variables
- gRPC communication should be secured in production
- Rate limiting should be implemented for external API calls
- Input validation on all requests

## Future Enhancements

- [ ] Cache weather data to reduce API calls
- [ ] Support for multiple geographic locations
- [ ] Historical data analysis for improved predictions
- [ ] Webhook notifications for critical weather events
- [ ] Multi-language support for recommendations
- [ ] Custom AI model fine-tuning with salt production data

## License

Proprietary - Brinex Salt Production Platform
