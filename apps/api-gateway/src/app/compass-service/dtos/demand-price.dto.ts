import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

// ─── Monthly Demand Price Data ───────────────────────────────────────────────

export class MonthlyDemandPriceDto {
  @ApiProperty({ example: '2026-04', description: 'Month in YYYY-MM format' })
  month: string;

  @ApiProperty({ example: 2731, description: 'Total demand (sum of target quantities) for the month' })
  totalDemand: number;

  @ApiProperty({ example: 1200, description: 'Average price per bag for the month' })
  pricePerBag: number;
}

// ─── Request ──────────────────────────────────────────────────────────────────

export class GetDemandPriceRequestDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'startMonth must be in YYYY-MM format' })
  @ApiProperty({
    description: 'Start month in YYYY-MM format',
    example: '2025-10',
  })
  startMonth: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'endMonth must be in YYYY-MM format' })
  @ApiProperty({
    description: 'End month in YYYY-MM format',
    example: '2026-02',
  })
  endMonth: string;
}

// ─── Response ─────────────────────────────────────────────────────────────────

export class GetDemandPriceResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Demand and price data retrieved successfully' })
  message: string;

  @ApiProperty({ type: [MonthlyDemandPriceDto] })
  data: MonthlyDemandPriceDto[];
}
