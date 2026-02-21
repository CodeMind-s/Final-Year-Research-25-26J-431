import { Controller, UseGuards, Inject, Post, Body, Get, Patch, Param, Delete, Query, Req } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { SubscriptionCheck } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { Logger } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import {
  CreateDealDto,
  CreateDealResponseDto,
  GetDealResponseDto,
  GetDealsResponseDto,
  UpdateDealDto,
  UpdateDealResponseDto,
  DeleteDealResponseDto,
  DealStatus,
} from './dtos/deal.dto';

@ApiTags('Deals')
@Controller('deals')
export class DealController {
  private dealService: any;
  private readonly logger = new Logger(DealController.name);

  constructor(@Inject('COMPASS_PACKAGE') private client: ClientGrpcProxy) {
    this.dealService = this.client.getService('DealService');
  }

  @Post('offer/:offerId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Deal for an Offer (landowner)' })
  @ApiParam({ name: 'offerId', type: String, description: 'Distributor Offer ID', example: '675945c5d1234567890abcde' })
  @ApiBody({ type: CreateDealDto })
  @ApiResponse({ status: 201, description: 'Deal created successfully', type: CreateDealResponseDto })
  @ApiResponse({ status: 400, description: 'Failed to create deal' })
  async createDeal(
    @Param('offerId') offerId: string,
    @Body() body: CreateDealDto,
    @Req() req: any
  ): Promise<CreateDealResponseDto> {
    const landownerId = req.user.userId;

    try {
      const requestData = {
        landownerId,
        offerId,
        quantity: body.quantity,
        // pricePerKilo: body.pricePerKilo,
      };

      const result = await firstValueFrom(
        this.dealService.CreateDeal(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Create Deal error: ${error.message}`);
            throw new HttpException('Failed to create deal', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      return {
        success: result.success,
        message: result.message,
        data: result.data || null,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.DISTRIBUTOR)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Deal by ID (landowner, distributor)' })
  @ApiParam({ name: 'id', type: String, description: 'Deal ID', example: '675945c5d1234567890abcde' })
  @ApiBody({ type: UpdateDealDto })
  @ApiResponse({ status: 200, description: 'Deal updated successfully', type: UpdateDealResponseDto })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async updateDeal(
    @Param('id') id: string,
    @Body() body: UpdateDealDto
  ): Promise<UpdateDealResponseDto> {
    try {
      const requestData: any = { id };

      // Add only defined fields to the request
      if (body.quantity !== undefined) requestData.quantity = body.quantity;
      if (body.pricePerKilo !== undefined) requestData.pricePerKilo = body.pricePerKilo;
      if (body.status !== undefined) requestData.status = body.status;

      const result = await firstValueFrom(
        this.dealService.UpdateDeal(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Update Deal error: ${error.message}`);
            throw new HttpException('Failed to update deal', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      return {
        success: result.success,
        message: result.message,
        data: result.data || null,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete Deal by ID (landowner)' })
  @ApiParam({ name: 'id', type: String, description: 'Deal ID', example: '675945c5d1234567890abcde' })
  @ApiResponse({ status: 200, description: 'Deal deleted successfully', type: DeleteDealResponseDto })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async deleteDeal(@Param('id') id: string): Promise<DeleteDealResponseDto> {
    try {
      const requestData = { id };

      const result = await firstValueFrom(
        this.dealService.DeleteDeal(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Delete Deal error: ${error.message}`);
            throw new HttpException('Failed to delete deal', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      return {
        success: result.success,
        message: result.message,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Get('landowner/my-deals')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get My Deals as Landowner (landowner)' })
  @ApiQuery({ name: 'status', enum: DealStatus, description: 'Filter by deal status', required: false })
  @ApiQuery({ name: 'page', type: Number, description: 'Page number for pagination (starts from 1)', required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, description: 'Number of items per page', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Deals retrieved successfully', type: GetDealsResponseDto })
  @ApiResponse({ status: 400, description: 'Failed to fetch deals' })
  async getLandownerDeals(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ): Promise<GetDealsResponseDto> {
    const landownerId = req.user.userId;

    try {
      const requestData: any = { landownerId };
      if (status && status.trim()) requestData.status = status;
      if (page !== undefined && page !== null && page >= 1) requestData.page = page;
      if (limit !== undefined && limit !== null && limit > 0) requestData.limit = limit;

      const result = await firstValueFrom(
        this.dealService.GetDeals(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Landowner Deals error: ${error.message}`);
            throw new HttpException('Failed to fetch deals', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any[]; pagination?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(`Fetched ${result.data?.length || 0} deals for landowner ${landownerId}`);

      return {
        success: result.success,
        message: result.message,
        data: result.data || [],
        pagination: result.pagination,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Get('distributor/my-deals')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.DISTRIBUTOR)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get My Deals as Distributor (distributor)' })
  @ApiQuery({ name: 'status', enum: DealStatus, description: 'Filter by deal status', required: false })
  @ApiQuery({ name: 'page', type: Number, description: 'Page number for pagination (starts from 1)', required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, description: 'Number of items per page', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Deals retrieved successfully', type: GetDealsResponseDto })
  @ApiResponse({ status: 400, description: 'Failed to fetch deals' })
  async getDistributorDeals(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ): Promise<GetDealsResponseDto> {
    const distributorId = req.user.userId;

    try {
      const requestData: any = { distributorId };
      if (status && status.trim()) requestData.status = status;
      if (page !== undefined && page !== null && page >= 1) requestData.page = page;
      if (limit !== undefined && limit !== null && limit > 0) requestData.limit = limit;

      const result = await firstValueFrom(
        this.dealService.GetDeals(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Distributor Deals error: ${error.message}`);
            throw new HttpException('Failed to fetch deals', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any[]; pagination?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(`Fetched ${result.data?.length || 0} deals for distributor ${distributorId}`);

      return {
        success: result.success,
        message: result.message,
        data: result.data || [],
        pagination: result.pagination,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.DISTRIBUTOR)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Deal by ID (landowner, distributor)' })
  @ApiParam({ name: 'id', type: String, description: 'Deal ID', example: '675945c5d1234567890abcde' })
  @ApiResponse({ status: 200, description: 'Deal retrieved successfully', type: GetDealResponseDto })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async getDeal(@Param('id') id: string): Promise<GetDealResponseDto> {
    try {
      if (!id) {
        throw new HttpException('Deal ID is required', HttpStatus.BAD_REQUEST);
      }

      const requestData = { id };

      const result = await firstValueFrom(
        this.dealService.GetDeal(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Deal error: ${error.message}`);
            throw new HttpException('Failed to fetch deal', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      return {
        success: result.success,
        message: result.message,
        data: result.data || null,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SALTSOCIETY, Role.ADMIN, Role.SUPERADMIN)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get All Deals (admin, superadmin, saltsociety)' })
  @ApiQuery({ name: 'status', enum: DealStatus, description: 'Filter by deal status', required: false })
  @ApiQuery({ name: 'page', type: Number, description: 'Page number for pagination (starts from 1)', required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, description: 'Number of items per page', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Deals retrieved successfully', type: GetDealsResponseDto })
  @ApiResponse({ status: 400, description: 'Failed to fetch deals' })
  async getDeals(
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ): Promise<GetDealsResponseDto> {
    try {
      const requestData: any = {};
      if (status && status.trim()) requestData.status = status;
      if (page !== undefined && page !== null && page >= 1) requestData.page = page;
      if (limit !== undefined && limit !== null && limit > 0) requestData.limit = limit;

      const result = await firstValueFrom(
        this.dealService.GetDeals(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Deals error: ${error.message}`);
            throw new HttpException('Failed to fetch deals', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any[]; pagination?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(`Fetched ${result.data?.length || 0} deals`);

      return {
        success: result.success,
        message: result.message,
        data: result.data || [],
        pagination: result.pagination,
      };
    } catch (error: any) {
      throw error;
    }
  }
}
