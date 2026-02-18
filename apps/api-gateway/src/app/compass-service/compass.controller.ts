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
  CreatePlanDto,
  CreatePlanResponseDto,
  GetPlanResponseDto,
  GetPlansResponseDto,
  UpdatePlanDto,
  UpdatePlanResponseDto,
  DeletePlanResponseDto,
  HarvestStatus,
} from './dtos/harvest-plan.dto';

@ApiTags('Harvest Plans')
@Controller('harvest-plans')
export class CompassController {
  private harvestPlanService: any;
  private readonly logger = new Logger(CompassController.name);

  constructor(@Inject('COMPASS_PACKAGE') private client: ClientGrpcProxy) {
    this.harvestPlanService = this.client.getService('HarvestPlanService');
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Harvest Plan (landowner)' })
  @ApiBody({ type: CreatePlanDto })
  @ApiResponse({ status: 201, description: 'Harvest plan created successfully', type: CreatePlanResponseDto })
  @ApiResponse({ status: 400, description: 'Failed to create harvest plan' })
  async createPlan(@Body() body: CreatePlanDto, @Req() req: any): Promise<CreatePlanResponseDto> {
    const userId = req.user.userId;

    try {
      // Convert enum string to number for gRPC
      const harvestStatusMap: Record<HarvestStatus, number> = {
        [HarvestStatus.FRESHER]: 0,
        [HarvestStatus.MIDLEVEL]: 1,
        [HarvestStatus.HARVESTED]: 2,
        [HarvestStatus.DISPOSED]: 3,
      };

      const requestData = {
        userId,
        saltBeds: body.saltBeds,
        harvestStatus: harvestStatusMap[body.harvestStatus],
        planPeriod: body.planPeriod,
        startDate: body.startDate,
        predictedProduction: body.predictedProduction ?? 0,
        actualProduction: body.actualProduction ?? 0,
        workerCount: body.workerCount ?? 0,
        predictedProfit: body.predictedProfit ?? 0,
        actualProfit: body.actualProfit ?? 0,
        expenses: body.expenses ?? 0,
        earnings: body.earnings ?? 0,
        avgSellingPrice: body.avgSellingPrice ?? 0,
      };

      const result = await firstValueFrom(
        this.harvestPlanService.CreatePlan(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Create Harvest Plan error: ${error.message}`);
            throw new HttpException('Failed to create harvest plan', HttpStatus.BAD_REQUEST);
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

  @Get('my-plans')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get My Harvest Plans (landowner)' })
  @ApiQuery({ name: 'status', type: String, description: 'Filter by harvest status (FRESHER, MIDLEVEL, HARVESTED, DISPOSED)', required: false })
  @ApiQuery({ name: 'startDate', type: String, description: 'Filter by start date (ISO format)', required: false })
  @ApiQuery({ name: 'endDate', type: String, description: 'Filter by end date (ISO format)', required: false })
  @ApiQuery({ name: 'page', type: Number, description: 'Page number for pagination (starts from 1)', required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, description: 'Number of items per page', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Harvest plans retrieved successfully', type: GetPlansResponseDto })
  @ApiResponse({ status: 400, description: 'Failed to fetch harvest plans' })
  async getMyPlans(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ): Promise<GetPlansResponseDto> {
    const userId = req.user.userId;

    try {
      const requestData: any = { userId };
      if (status && status.trim()) requestData.status = status;
      if (startDate && startDate.trim()) requestData.startDate = startDate;
      if (endDate && endDate.trim()) requestData.endDate = endDate;
      if (page !== undefined && page !== null && page >= 1) requestData.page = page;
      if (limit !== undefined && limit !== null && limit > 0) requestData.limit = limit;

      const result = await firstValueFrom(
        this.harvestPlanService.GetPlans(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get My Harvest Plans error: ${error.message}`);
            throw new HttpException('Failed to fetch harvest plans', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any[] };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(`Fetched ${result.data?.length || 0} plans for user ${userId}`);

      return {
        success: result.success,
        message: result.message,
        data: result.data || [],
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Harvest Plan by ID (landowner)' })
  @ApiParam({ name: 'id', type: String, description: 'Plan ID', example: '675945c5d1234567890abcde' })
  @ApiResponse({ status: 200, description: 'Harvest plan retrieved successfully', type: GetPlanResponseDto })
  @ApiResponse({ status: 404, description: 'Harvest plan not found' })
  async getPlan(@Param('id') id: string): Promise<GetPlanResponseDto> {
    try {
      if (!id) {
        throw new HttpException('Plan ID is required', HttpStatus.BAD_REQUEST);
      }

      const requestData = { id };

      const result = await firstValueFrom(
        this.harvestPlanService.GetPlan(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Harvest Plan error: ${error.message}`);
            throw new HttpException('Failed to fetch harvest plan', HttpStatus.BAD_REQUEST);
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
  @ApiOperation({ summary: 'Get All Harvest Plans (admin, superadmin, saltsociety)' })
  @ApiQuery({ name: 'userId', type: String, description: 'Filter by user ID', required: false })
  @ApiQuery({ name: 'status', type: String, description: 'Filter by harvest status (FRESHER, MIDLEVEL, HARVESTED, DISPOSED)', required: false })
  @ApiQuery({ name: 'startDate', type: String, description: 'Filter by start date (ISO format)', required: false })
  @ApiQuery({ name: 'endDate', type: String, description: 'Filter by end date (ISO format)', required: false })
  @ApiQuery({ name: 'page', type: Number, description: 'Page number for pagination (starts from 1)', required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, description: 'Number of items per page', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Harvest plans retrieved successfully', type: GetPlansResponseDto })
  @ApiResponse({ status: 400, description: 'Failed to fetch harvest plans' })
  async getPlans(
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ): Promise<GetPlansResponseDto> {
    try {
      const requestData: any = {};
      if (userId && userId.trim()) requestData.userId = userId;
      if (status && status.trim()) requestData.status = status;
      if (startDate && startDate.trim()) requestData.startDate = startDate;
      if (endDate && endDate.trim()) requestData.endDate = endDate;
      if (page !== undefined && page !== null && page >= 1) requestData.page = page;
      if (limit !== undefined && limit !== null && limit > 0) requestData.limit = limit;

      const result = await firstValueFrom(
        this.harvestPlanService.GetPlans(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Harvest Plans error: ${error.message}`);
            throw new HttpException('Failed to fetch harvest plans', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any[] };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(`Fetched ${result.data?.length || 0} plans`);

      return {
        success: result.success,
        message: result.message,
        data: result.data || [],
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Harvest Plan by ID (landowner)' })
  @ApiParam({ name: 'id', type: String, description: 'Plan ID', example: '675945c5d1234567890abcde' })
  @ApiBody({ type: UpdatePlanDto })
  @ApiResponse({ status: 200, description: 'Harvest plan updated successfully', type: UpdatePlanResponseDto })
  @ApiResponse({ status: 404, description: 'Harvest plan not found' })
  async updatePlan(
    @Param('id') id: string,
    @Body() body: UpdatePlanDto
  ): Promise<UpdatePlanResponseDto> {
    try {
      const requestData: any = { id };

      // Convert enum string to number for gRPC
      const harvestStatusMap: Record<HarvestStatus, number> = {
        [HarvestStatus.FRESHER]: 0,
        [HarvestStatus.MIDLEVEL]: 1,
        [HarvestStatus.HARVESTED]: 2,
        [HarvestStatus.DISPOSED]: 3,
      };

      // Add only defined fields to the request
      if (body.saltBeds !== undefined) requestData.saltBeds = body.saltBeds;
      if (body.harvestStatus !== undefined) requestData.harvestStatus = harvestStatusMap[body.harvestStatus];
      if (body.planPeriod !== undefined) requestData.planPeriod = body.planPeriod;
      if (body.startDate !== undefined) requestData.startDate = body.startDate;
      if (body.predictedProduction !== undefined) requestData.predictedProduction = body.predictedProduction;
      if (body.actualProduction !== undefined) requestData.actualProduction = body.actualProduction;
      if (body.workerCount !== undefined) requestData.workerCount = body.workerCount;
      if (body.predictedProfit !== undefined) requestData.predictedProfit = body.predictedProfit;
      if (body.actualProfit !== undefined) requestData.actualProfit = body.actualProfit;
      if (body.expenses !== undefined) requestData.expenses = body.expenses;
      if (body.earnings !== undefined) requestData.earnings = body.earnings;
      if (body.avgSellingPrice !== undefined) requestData.avgSellingPrice = body.avgSellingPrice;

      const result = await firstValueFrom(
        this.harvestPlanService.UpdatePlan(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Update Harvest Plan error: ${error.message}`);
            throw new HttpException('Failed to update harvest plan', HttpStatus.BAD_REQUEST);
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
  @ApiOperation({ summary: 'Delete Harvest Plan by ID (landowner)' })
  @ApiParam({ name: 'id', type: String, description: 'Plan ID', example: '675945c5d1234567890abcde' })
  @ApiResponse({ status: 200, description: 'Harvest plan deleted successfully', type: DeletePlanResponseDto })
  @ApiResponse({ status: 404, description: 'Harvest plan not found' })
  async deletePlan(@Param('id') id: string): Promise<DeletePlanResponseDto> {
    try {
      const requestData = { id };

      const result = await firstValueFrom(
        this.harvestPlanService.DeletePlan(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Delete Harvest Plan error: ${error.message}`);
            throw new HttpException('Failed to delete harvest plan', HttpStatus.BAD_REQUEST);
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
}
