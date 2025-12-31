export class GenerateInvoiceRequestDto {
  dealId: string;
}

export class DealDetailsDto {
  dealId: string;
  sellerId: string;
  sellerName: string;
  landownerId: string;
  landownerName: string;
  quantity: number;
  pricePerTon: number;
  totalPrice: number;
  date: string;
}

export class GenerateInvoiceResponseDto {
  success: boolean;
  message: string;
  invoiceId?: string;
  dealDetails?: DealDetailsDto;
  pdfUrl?: string;
}

export class GetInvoiceRequestDto {
  invoiceId: string;
}

export class InvoiceDto {
  invoiceId: string;
  dealDetails: DealDetailsDto;
  pdfUrl?: string;
  createdAt: number;
}

export class GetInvoiceResponseDto {
  success: boolean;
  message: string;
  invoice?: InvoiceDto;
}

export class DownloadInvoiceRequestDto {
  invoiceId: string;
}

export class DownloadInvoiceResponseDto {
  success: boolean;
  message: string;
  pdfData?: Buffer;
  filename?: string;
}
