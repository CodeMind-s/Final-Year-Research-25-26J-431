import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { SearchService } from './search.service';
import {
  SearchSellersRequestDto,
  SearchSellersResponseDto,
  SearchLandownersRequestDto,
  SearchLandownersResponseDto,
} from './dtos/search.dto';

@Controller('Search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @GrpcMethod('SearchService', 'SearchSellers')
  async SearchSellers(
    data: SearchSellersRequestDto
  ): Promise<SearchSellersResponseDto> {
    return this.searchService.searchSellers(data);
  }

  @GrpcMethod('SearchService', 'SearchLandowners')
  async SearchLandowners(
    data: SearchLandownersRequestDto
  ): Promise<SearchLandownersResponseDto> {
    return this.searchService.searchLandowners(data);
  }
}
