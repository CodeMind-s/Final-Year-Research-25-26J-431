import { Controller, Get, UseGuards, Inject, Param, } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { ApiBearerAuth, ApiOperation, ApiTags, } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { SubscriptionCheck } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { Logger } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { HttpException } from '@nestjs/common';

@ApiTags('Crystallization')
@Controller('crystallization')
export class CrystallizationController {
  private crystallizationService: any;
  private readonly logger = new Logger(CrystallizationController.name);

  constructor(@Inject('CRYSTALLIZATION_PACKAGE') private client: ClientGrpcProxy) {
    this.crystallizationService = this.client.getService('CrystallizationService');
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @Roles(Role.TRAVELER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get log details' })
  async getTrip(@Param('id') id: string) {
    try {
      const result = await firstValueFrom(
        this.crystallizationService.GetLogById({ logId: id }).pipe(
          catchError((error) => {
            this.logger.error(`log error: ${error.message}`);
            throw new HttpException('log not found', HttpStatus.NOT_FOUND);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }
}