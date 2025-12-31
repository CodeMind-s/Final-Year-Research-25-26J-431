import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { InvoiceService } from './invoice.service';
import {
  GenerateInvoiceRequestDto,
  GenerateInvoiceResponseDto,
  GetInvoiceRequestDto,
  GetInvoiceResponseDto,
  DownloadInvoiceRequestDto,
  DownloadInvoiceResponseDto,
} from './dtos/invoice.dto';

@Controller('Invoice')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @GrpcMethod('InvoiceService', 'GenerateInvoice')
  async GenerateInvoice(
    data: GenerateInvoiceRequestDto
  ): Promise<GenerateInvoiceResponseDto> {
    return this.invoiceService.generateInvoice(data);
  }

  @GrpcMethod('InvoiceService', 'GetInvoice')
  async GetInvoice(data: GetInvoiceRequestDto): Promise<GetInvoiceResponseDto> {
    return this.invoiceService.getInvoice(data);
  }

  @GrpcMethod('InvoiceService', 'DownloadInvoice')
  async DownloadInvoice(
    data: DownloadInvoiceRequestDto
  ): Promise<DownloadInvoiceResponseDto> {
    return this.invoiceService.downloadInvoice(data);
  }
}
