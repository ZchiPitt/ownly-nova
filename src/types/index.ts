/**
 * Ownly Type Exports
 * Central export point for all TypeScript types
 */

// ============================================
// Database Entity Types
// ============================================

export type {
  // Core entity interfaces
  Profile,
  UserSettings,
  Category,
  Location,
  Item,
  Notification,
  PushSubscription,
  ItemAIMetadata,
  NotificationType,
  NotificationData,
  // Supabase Database type definition
  Database,
  // Utility types
  TableRow,
  TableInsert,
  TableUpdate,
} from './database';

// ============================================
// API Request/Response Types
// ============================================

export type {
  // Generic API types
  ApiResponse,
  ApiError,
  ApiResult,
  PaginatedResponse,
  // Auth types
  SignUpRequest,
  SignInRequest,
  ResetPasswordRequest,
  UpdatePasswordRequest,
  AuthResponse,
  // Profile types
  UpdateProfileRequest,
  ProfileResponse,
  // User Settings types
  UpdateUserSettingsRequest,
  UserSettingsResponse,
  // Category types
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CategoryResponse,
  CategoriesResponse,
  // Location types
  CreateLocationRequest,
  UpdateLocationRequest,
  LocationResponse,
  LocationsResponse,
  LocationTreeNode,
  // Item types
  CreateItemRequest,
  UpdateItemRequest,
  ItemResponse,
  ItemsResponse,
  ItemWithRelations,
  ItemFilters,
  ItemSortOption,
  ItemListParams,
  // Notification types
  MarkNotificationReadRequest,
  NotificationResponse,
  NotificationsResponse,
  NotificationWithItem,
  // AI Analysis types
  DetectedItem,
  AnalyzeImageRequest,
  AnalyzeImageResponse,
  SimilarItem,
  ShoppingAnalyzeRequest,
  ShoppingAnalyzeResponse,
  // Embedding types
  GenerateEmbeddingRequest,
  GenerateEmbeddingResponse,
  // Dashboard types
  DashboardStats,
  ExpiringItem,
  RecentItem,
  // Search types
  SearchResult,
  SearchResponse,
  // Image upload types
  ImageUploadResult,
  ImageValidationError,
} from './api';

// ============================================
// Auth Context Types
// ============================================

export type { AuthContextValue } from './auth';
