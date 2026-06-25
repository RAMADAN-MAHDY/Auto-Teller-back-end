// ===========================
// User Roles
// ===========================
export enum UserRole {
  ADMIN = 'admin',
  EMPLOYEE = 'employee',
}

// ===========================
// Campaign Statuses
// ===========================
export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// ===========================
// Message Statuses
// ===========================
export enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

// ===========================
// Queue Names
// ===========================
export const QUEUE_NAMES = {
  CAMPAIGN: 'campaign-queue',
  SCHEDULER: 'scheduler-queue',
} as const;

// ===========================
// Job Types
// ===========================
export const JOB_TYPES = {
  PROCESS_CAMPAIGN: 'process-campaign',
  SEND_MESSAGE: 'send-message',
  CHECK_SCHEDULED: 'check-scheduled-campaigns',
  RECALCULATE_CUSTOMER_GROUPS: 'recalculate-customer-groups',
} as const;

// ===========================
// API Defaults
// ===========================
export const API_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
  SORT_FIELD: 'createdAt',
  SORT_ORDER: 'desc' as const,
} as const;

// ===========================
// Auth Constants
// ===========================
export const AUTH_CONSTANTS = {
  SALT_ROUNDS: 12,
  TOKEN_TYPE: 'Bearer',
} as const;

// ===========================
// Customer Group Types
// ===========================
export enum CustomerGroup {
  COMPLIANT = 'COMPLIANT',
  LATE = 'LATE',
  DEFAULTED = 'DEFAULTED',
  TRANSFERRED = 'TRANSFERRED',
}
