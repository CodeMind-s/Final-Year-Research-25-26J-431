import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice } from './schemas/invoice.schema';
import { Deal } from '../landowner/schemas/deal.schema';
import {
  GenerateInvoiceRequestDto,
  GenerateInvoiceResponseDto,
  GetInvoiceRequestDto,
  GetInvoiceResponseDto,
  DownloadInvoiceRequestDto,
  DownloadInvoiceResponseDto,
} from './dtos/invoice.dto';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectModel(Invoice.name)
    private invoiceModel: Model<Invoice>,
    @InjectModel(Deal.name)
    private dealModel: Model<Deal>
  ) {}

  async generateInvoice(
    data: GenerateInvoiceRequestDto
  ): Promise<GenerateInvoiceResponseDto> {
    try {
      const deal = await this.dealModel.findById(data.dealId);

      if (!deal) {
        return {
          success: false,
          message: `Deal not found with ID: ${data.dealId}`,
        };
      }

      const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const invoice = await this.invoiceModel.create({
        invoiceId,
        dealDetails: {
          dealId: deal._id.toString(),
          sellerId: deal.sellerId,
          sellerName: deal.sellerName,
          landownerId: deal.landownerId,
          landownerName: deal.landownerName,
          quantity: deal.totalQuantity,
          pricePerTon: deal.totalRevenue / deal.totalQuantity,
          totalPrice: deal.totalRevenue,
          date: new Date().toISOString().split('T')[0],
        },
        pdfUrl: `/invoices/${invoiceId}.pdf`,
      });

      return {
        success: true,
        message: 'Invoice generated successfully',
        invoiceId: invoice.invoiceId,
        dealDetails: {
          dealId: invoice.dealDetails.dealId,
          sellerId: invoice.dealDetails.sellerId,
          sellerName: invoice.dealDetails.sellerName,
          landownerId: invoice.dealDetails.landownerId,
          landownerName: invoice.dealDetails.landownerName,
          quantity: invoice.dealDetails.quantity,
          pricePerTon: invoice.dealDetails.pricePerTon,
          totalPrice: invoice.dealDetails.totalPrice,
          date: invoice.dealDetails.date,
        },
        pdfUrl: invoice.pdfUrl,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to generate invoice: ${error.message}`
      );
    }
  }

  async getInvoice(data: GetInvoiceRequestDto): Promise<GetInvoiceResponseDto> {
    try {
      const invoice = await this.invoiceModel.findOne({
        invoiceId: data.invoiceId,
      });

      if (!invoice) {
        return {
          success: false,
          message: `Invoice not found with ID: ${data.invoiceId}`,
        };
      }

      return {
        success: true,
        message: 'Invoice fetched successfully',
        invoice: {
          invoiceId: invoice.invoiceId,
          dealDetails: {
            dealId: invoice.dealDetails.dealId,
            sellerId: invoice.dealDetails.sellerId,
            sellerName: invoice.dealDetails.sellerName,
            landownerId: invoice.dealDetails.landownerId,
            landownerName: invoice.dealDetails.landownerName,
            quantity: invoice.dealDetails.quantity,
            pricePerTon: invoice.dealDetails.pricePerTon,
            totalPrice: invoice.dealDetails.totalPrice,
            date: invoice.dealDetails.date,
          },
          pdfUrl: invoice.pdfUrl,
          createdAt: invoice.createdAt?.getTime() || Date.now(),
        },
      };
    } catch (error) {
      throw new BadRequestException(`Failed to get invoice: ${error.message}`);
    }
  }

  async downloadInvoice(
    data: DownloadInvoiceRequestDto
  ): Promise<DownloadInvoiceResponseDto> {
    try {
      const invoice = await this.invoiceModel.findOne({
        invoiceId: data.invoiceId,
      });

      if (!invoice) {
        return {
          success: false,
          message: `Invoice not found with ID: ${data.invoiceId}`,
        };
      }

      // TODO: Generate actual PDF using a library like pdfkit or puppeteer
      // For now, return a mock response
      const mockPdfData = Buffer.from('Mock PDF data');

      return {
        success: true,
        message: 'Invoice downloaded successfully',
        pdfData: mockPdfData,
        filename: `${invoice.invoiceId}.pdf`,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to download invoice: ${error.message}`
      );
    }
  }
}
