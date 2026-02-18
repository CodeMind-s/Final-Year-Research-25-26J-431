// Request DTOs
export interface CreatePlanDto {
  userId: string; // Will be set from authenticated user context
  saltBeds: number; // Count of salt beds
  harvestStatus: number; // 0=FRESHER, 1=MIDLEVEL, 2=HARVESTED
  planPeriod: number; // Period in days (typically 45)
  startDate: string;
  predictedProduction?: number;
  actualProduction?: number;
  workerCount?: number;
  predictedProfit?: number;
  actualProfit?: number;
  expenses?: number;
  earnings?: number;
  avgSellingPrice?: number;
}

export interface GetPlanDto {
  id: string;
}

export interface GetPlansDto {
  userId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface UpdatePlanDto {
  id: string;
  saltBeds?: number; // Count of salt beds
  harvestStatus?: number;
  planPeriod?: number;
  startDate?: string;
  predictedProduction?: number;
  actualProduction?: number;
  workerCount?: number;
  predictedProfit?: number;
  actualProfit?: number;
  expenses?: number;
  earnings?: number;
  avgSellingPrice?: number;
}

export interface DeletePlanDto {
  id: string;
}

// Response DTOs
export interface CreatePlanResponseDto {
  success: boolean;
  message: string;
  data?: any;
}

export interface GetPlanResponseDto {
  success: boolean;
  message: string;
  data?: any;
}

export interface GetPlansResponseDto {
  success: boolean;
  message: string;
  data?: any[];
}

export interface UpdatePlanResponseDto {
  success: boolean;
  message: string;
  data?: any;
}

export interface DeletePlanResponseDto {
  success: boolean;
  message: string;
}
