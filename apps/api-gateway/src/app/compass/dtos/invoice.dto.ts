import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Generate Invoice
export class GenerateInvoiceResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  invoiceId?: string;

  @ApiPropertyOptional()
  dealDetails?: {
    dealId: string;
    sellerId: string;
    sellerName: string;
    landownerId: string;
    landownerName: string;
    quantity: number;
    pricePerTon: number;
    totalPrice: number;
    date: string;
  };

  @ApiPropertyOptional()
  pdfUrl?: string;
}

// Get Invoice
export class GetInvoiceResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  invoice?: {
    invoiceId: string;
    dealDetails: {
      dealId: string;
      sellerId: string;
      sellerName: string;
      landownerId: string;
      landownerName: string;
      quantity: number;
      pricePerTon: number;
      totalPrice: number;
      date: string;
    };
    pdfUrl: string;
    createdAt: number;
  };
}

// Download Invoice
export class DownloadInvoiceResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  pdfData?: any;

  @ApiPropertyOptional()
  filename?: string;
}
