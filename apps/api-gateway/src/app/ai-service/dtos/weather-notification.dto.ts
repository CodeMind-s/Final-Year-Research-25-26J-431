import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsIn, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LocalizedTextDto {
  @ApiProperty({ 
    example: 'සති 4ක් පමණ රැඳී සිටින්න', 
    description: 'Text in Sinhala' 
  })
  @IsString()
  si: string;

  @ApiProperty({ 
    example: '~4 வாரங்களுக்கு நிறுத்தி வைக்கவும்', 
    description: 'Text in Tamil' 
  })
  @IsString()
  ta: string;

  @ApiProperty({ 
    example: 'Hold for ~4 weeks', 
    description: 'Text in English' 
  })
  @IsString()
  en: string;
}

export class WeatherNotificationResponseDto {
  @ApiProperty({ 
    type: LocalizedTextDto,
    description: 'Recommendation notification message in three languages' 
  })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  notification: LocalizedTextDto;

  @ApiProperty({ 
    type: LocalizedTextDto,
    description: 'Detailed description of the recommendation in three languages' 
  })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  description: LocalizedTextDto;

  @ApiProperty({ 
    example: 45, 
    description: 'Recommended plan duration in days (30 or 45)' 
  })
  @IsNumber()
  @IsIn([30, 45])
  plandays: number;

  @ApiProperty({ 
    example: '2026-03-07', 
    description: 'Recommended start date (ISO format)' 
  })
  @IsDateString()
  startdate: string;
}
