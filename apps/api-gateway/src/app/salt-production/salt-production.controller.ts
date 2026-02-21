import {
  Controller,
  Inject,
  Post,
  Body,
  Get,
  Put,
  Param,
  Delete,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { RequirePlan } from '../auth/decorators/plan.decorator';
import {
  CreateActualMonthlyProductionDto,
  CreateActualMonthlyProductionResponseDto,
  UpdateActualMonthlyProductionDto,
  UpdateActualMonthlyProductionResponseDto,
  GetActualMonthlyProductionByRangeResponseDto,
  GetActualMonthlyProductionByIdResponseDto,
  GetActualMonthlyProductionByMonthResponseDto,
  DeleteActualMonthlyProductionResponseDto,
} from './dtos/salt-production.dto';

@ApiTags('Salt Productions')
@Controller('saltproductions')
export class SaltProductionController {
  private saltProductionService: any;
  private readonly logger = new Logger(SaltProductionController.name);

  constructor(
    @Inject('SALT_PRODUCTION_PACKAGE') private client: ClientGrpcProxy
  ) {
    this.saltProductionService =
      this.client.getService('SaltProductionService');
  }

  @Post()
  @Roles(Role.SALTSOCIETY)
  @RequirePlan(1)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update actual monthly production' })
  @ApiBody({ type: CreateActualMonthlyProductionDto })
  @ApiResponse({
    status: 201,
    description: 'Actual monthly production created/updated successfully',
    type: CreateActualMonthlyProductionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createActualMonthlyProduction(
    @Body() body: CreateActualMonthlyProductionDto
  ): Promise<CreateActualMonthlyProductionResponseDto> {
    try {
      const result = (await firstValueFrom(
        this.saltProductionService
          .CreateActualMonthlyProduction(body)
          .pipe(
            catchError((error) => {
              this.logger.error(
                `Create Actual Monthly Production error: ${error.message}`
              );
              throw new HttpException(
                'Failed to create actual monthly production',
                HttpStatus.BAD_REQUEST
              );
            })
          )
      )) as CreateActualMonthlyProductionResponseDto;

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get()
  @Roles(Role.SALTSOCIETY)
  @RequirePlan(1)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get actual monthly productions by month range' })
  @ApiQuery({
    name: 'startMonth',
    type: String,
    description: 'Start month in YYYY-MM format',
    example: '2023-01',
  })
  @ApiQuery({
    name: 'endMonth',
    type: String,
    description: 'End month in YYYY-MM format',
    example: '2023-12',
  })
  @ApiResponse({
    status: 200,
    description: 'Actual monthly productions fetched successfully',
    type: GetActualMonthlyProductionByRangeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'No productions found' })
  async getActualMonthlyProductionByRange(
    @Query('startMonth') startMonth: string,
    @Query('endMonth') endMonth: string
  ): Promise<GetActualMonthlyProductionByRangeResponseDto> {
    try {
      if (!startMonth || !endMonth) {
        throw new HttpException(
          'Both startMonth and endMonth parameters are required',
          HttpStatus.BAD_REQUEST
        );
      }

      const requestData = {
        startMonth,
        endMonth,
      };

      const result = (await firstValueFrom(
        this.saltProductionService
          .GetActualMonthlyProductionByRange(requestData)
          .pipe(
            catchError((error) => {
              this.logger.error(
                `Get Actual Monthly Production By Range error: ${error.message}`
              );
              throw new HttpException(
                'Failed to fetch actual monthly productions',
                HttpStatus.BAD_REQUEST
              );
            })
          )
      )) as GetActualMonthlyProductionByRangeResponseDto;

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get(':id')
  @Roles(Role.SALTSOCIETY)
  @RequirePlan(1)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get actual monthly production by ID' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Production ID',
    example: '694cea7dddfc3a10dca5f020',
  })
  @ApiResponse({
    status: 200,
    description: 'Actual monthly production fetched successfully',
    type: GetActualMonthlyProductionByIdResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Production not found' })
  async getActualMonthlyProductionById(
    @Param('id') id: string
  ): Promise<GetActualMonthlyProductionByIdResponseDto> {
    try {
      const requestData = { id };

      const result = (await firstValueFrom(
        this.saltProductionService
          .GetActualMonthlyProductionById(requestData)
          .pipe(
            catchError((error) => {
              this.logger.error(
                `Get Actual Monthly Production By ID error: ${error.message}`
              );
              throw new HttpException(
                'Failed to fetch actual monthly production',
                HttpStatus.BAD_REQUEST
              );
            })
          )
      )) as GetActualMonthlyProductionByIdResponseDto;

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('month/:month')
  @Roles(Role.SALTSOCIETY)
  @RequirePlan(1)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get actual monthly production by month' })
  @ApiParam({
    name: 'month',
    type: String,
    description: 'Month in YYYY-MM format',
    example: '2023-10',
  })
  @ApiResponse({
    status: 200,
    description: 'Actual monthly production fetched successfully',
    type: GetActualMonthlyProductionByMonthResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Production not found' })
  async getActualMonthlyProductionByMonth(
    @Param('month') month: string
  ): Promise<GetActualMonthlyProductionByMonthResponseDto> {
    try {
      const requestData = { month };

      const result = (await firstValueFrom(
        this.saltProductionService
          .GetActualMonthlyProductionByMonth(requestData)
          .pipe(
            catchError((error) => {
              this.logger.error(
                `Get Actual Monthly Production By Month error: ${error.message}`
              );
              throw new HttpException(
                'Failed to fetch actual monthly production',
                HttpStatus.BAD_REQUEST
              );
            })
          )
      )) as GetActualMonthlyProductionByMonthResponseDto;

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Put(':id')
  @Roles(Role.SALTSOCIETY)
  @RequirePlan(1)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update actual monthly production by ID' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Production ID',
    example: '694cea7dddfc3a10dca5f020',
  })
  @ApiBody({ type: UpdateActualMonthlyProductionDto })
  @ApiResponse({
    status: 200,
    description: 'Actual monthly production updated successfully',
    type: UpdateActualMonthlyProductionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Production not found' })
  async updateActualMonthlyProduction(
    @Param('id') id: string,
    @Body() body: UpdateActualMonthlyProductionDto
  ): Promise<UpdateActualMonthlyProductionResponseDto> {
    try {
      const requestData = {
        id,
        ...body,
      };

      const result = (await firstValueFrom(
        this.saltProductionService
          .UpdateActualMonthlyProduction(requestData)
          .pipe(
            catchError((error) => {
              this.logger.error(
                `Update Actual Monthly Production error: ${error.message}`
              );
              throw new HttpException(
                'Failed to update actual monthly production',
                HttpStatus.BAD_REQUEST
              );
            })
          )
      )) as UpdateActualMonthlyProductionResponseDto;

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Delete(':id')
  @Roles(Role.SALTSOCIETY)
  @RequirePlan(1)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete actual monthly production by ID' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Production ID',
    example: '694cea7dddfc3a10dca5f020',
  })
  @ApiResponse({
    status: 200,
    description: 'Actual monthly production deleted successfully',
    type: DeleteActualMonthlyProductionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Production not found' })
  async deleteActualMonthlyProduction(
    @Param('id') id: string
  ): Promise<DeleteActualMonthlyProductionResponseDto> {
    try {
      const requestData = { id };

      const result = (await firstValueFrom(
        this.saltProductionService
          .DeleteActualMonthlyProduction(requestData)
          .pipe(
            catchError((error) => {
              this.logger.error(
                `Delete Actual Monthly Production error: ${error.message}`
              );
              throw new HttpException(
                'Failed to delete actual monthly production',
                HttpStatus.BAD_REQUEST
              );
            })
          )
      )) as DeleteActualMonthlyProductionResponseDto;

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      return result;
    } catch (error: any) {
      throw error;
    }
  }
}
