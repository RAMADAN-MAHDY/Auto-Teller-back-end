export interface DashboardStatsDto {
  totalUsers: number;
  totalCustomers: number;
  totalGroups: number;
  totalTemplates: number;
  totalCampaigns: {
    total: number;
    draft: number;
    scheduled: number;
    running: number;
    completed: number;
    failed: number;
  };
  messageStats: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
}

export interface CampaignPerformanceDto {
  campaignId: string;
  title: string;
  totalMessages: number;
  successRate: number; // sent/delivered/read percentage
  deliveryRate: number; // delivered/total
  readRate: number; // read/total
}
