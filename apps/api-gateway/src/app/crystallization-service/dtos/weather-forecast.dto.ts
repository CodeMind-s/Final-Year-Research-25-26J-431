import { ApiProperty } from '@nestjs/swagger';

export class GetWeatherForecastResponseDto {
    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty({ example: 'Weather forecast fetched successfully' })
    message: string;

    @ApiProperty({ description: 'Full 16-day daily forecast payload from OpenWeatherMap', required: false })
    data?: any;
}
