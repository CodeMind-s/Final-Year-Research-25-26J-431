import { Controller, UseGuards, Inject, Get, Query } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { SubscriptionCheck } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { Logger, HttpStatus, HttpException } from '@nestjs/common';
import {
  SearchSellersResponseDto,
  SearchLandownersResponseDto,
} from './dtos/search.dto';

@ApiTags('Compass - Search')
@Controller('compass/search')
export class SearchController {
  private searchService: any;
  private readonly logger = new Logger(SearchController.name);

  constructor(@Inject('COMPASS_SEARCH_PACKAGE') private client: ClientGrpcProxy) {
    this.searchService = this.client.getService('SearchService');
  }

  @Get('sellers')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search sellers' })
  @ApiQuery({ name: 'name', type: String, required: false })
  @ApiQuery({ name: 'minPrice', type: Number, required: false })
  @ApiQuery({ name: 'maxPrice', type: Number, required: false })
  @ApiQuery({ name: 'reliability', type: String, required: false })
  @ApiResponse({ status: 200, description: 'Sellers fetched successfully', type: SearchSellersResponseDto })
  async searchSellers(
    @Query('name') name?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('reliability') reliability?: string
  ): Promise<SearchSellersResponseDto> {
    try {
      const result = await firstValueFrom(
        this.searchService.SearchSellers({ 
          name: name || '', 
          minPrice: minPrice || 0, 
          maxPrice: maxPrice || 0, 
          reliability: reliability || '' 
        }).pipe(
          catchError((error) => {
            this.logger.error(`Search Sellers error: ${error.message}`);
            throw new HttpException('Failed to search sellers', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('landowners')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search landowners' })
  @ApiQuery({ name: 'name', type: String, required: false })
  @ApiQuery({ name: 'minTons', type: Number, required: false })
  @ApiQuery({ name: 'priority', type: Boolean, required: false })
  @ApiResponse({ status: 200, description: 'Landowners fetched successfully', type: SearchLandownersResponseDto })
  async searchLandowners(
    @Query('name') name?: string,
    @Query('minTons') minTons?: number,
    @Query('priority') priority?: boolean
  ): Promise<SearchLandownersResponseDto> {
    try {
      const result = await firstValueFrom(
        this.searchService.SearchLandowners({ 
          name: name || '', 
          minTons: minTons || 0, 
          priority: priority || false 
        }).pipe(
          catchError((error) => {
            this.logger.error(`Search Landowners error: ${error.message}`);
            throw new HttpException('Failed to search landowners', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }
}
