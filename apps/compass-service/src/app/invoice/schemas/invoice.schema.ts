import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class InvoiceDealDetails {
  @Prop({ required: true })
  dealId: string;

  @Prop({ required: true })
  sellerId: string;

  @Prop({ required: true })
  sellerName: string;

  @Prop({ required: true })
  landownerId: string;

  @Prop({ required: true })
  landownerName: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  pricePerTon: number;

  @Prop({ required: true })
  totalPrice: number;

  @Prop({ required: true })
  date: string;
}

@Schema({ timestamps: true })
export class Invoice extends Document {
  @Prop({ required: true, unique: true })
  invoiceId: string;

  @Prop({ type: InvoiceDealDetails, required: true })
  dealDetails: InvoiceDealDetails;

  @Prop({ required: false })
  pdfUrl?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
