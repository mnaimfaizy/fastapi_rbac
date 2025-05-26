// react-frontend/src/services/dashboard.service.ts
import api from './api';
import { DashboardData } from '../models/dashboard';

const BASE_URL = '/dashboard';

export interface DashboardApiResponse {
  data: DashboardData;
  message: string;
}

export const dashboardService = {
  getDashboardData: async (): Promise<DashboardData> => {
    const response = await api.get<DashboardApiResponse>(BASE_URL);
    return response.data.data; // Assuming backend wraps in a 'data' object then another 'data' for the actual content
  },
};
