/**
 * API request and response types for Ownly
 * Used for Edge Functions and client-side data fetching
 */

import type {
  Profile,
  UserSettings,
  Category,
  Location,
  Item,
  Notification,
  ItemAIMetadata,
} from './database';

// ============================================
// Generic API Response Types
// ============================================

/**
 * Standard API success response
 */
export interface ApiResponse<T> {
  data: T;
  error: null;
}

/**
 * Standard API error response
 */
export interface ApiError {
  data: null;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Combined API result type
 */
export type ApiResult<T> = ApiResponse<T> | ApiError;

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

// ============================================
// Auth Request/Response Types
// ============================================

export interface SignUpRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface UpdatePasswordRequest {
  newPassword: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
  } | null;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  } | null;
}

// ============================================
// Profile Request/Response Types
// ============================================

export interface UpdateProfileRequest {
  display_name?: string;
  avatar_url?: string;
}

export type ProfileResponse = Profile;

// ============================================
// User Settings Request/Response Types
// ============================================

export interface UpdateUserSettingsRequest {
  reminder_enabled?: boolean;
  reminder_threshold_days?: number;
  expiration_reminder_days?: number;
  push_notifications_enabled?: boolean;
  default_view?: 'gallery' | 'list';
}

export type UserSettingsResponse = UserSettings;

// ============================================
// Category Request/Response Types
// ============================================

export interface CreateCategoryRequest {
  name: string;
  icon?: string;
  color?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  icon?: string;
  color?: string;
  sort_order?: number;
}

export type CategoryResponse = Category;

export type CategoriesResponse = Category[];

// ============================================
// Location Request/Response Types
// ============================================

export interface CreateLocationRequest {
  name: string;
  parent_id?: string | null;
  icon?: string;
  photo_url?: string | null;
}

export interface UpdateLocationRequest {
  name?: string;
  parent_id?: string | null;
  icon?: string;
  photo_url?: string | null;
}

export type LocationResponse = Location;

export type LocationsResponse = Location[];

/**
 * Location with expanded children for tree display
 */
export interface LocationTreeNode extends Location {
  children: LocationTreeNode[];
}

// ============================================
// Item Request/Response Types
// ============================================

export interface CreateItemRequest {
  photo_url: string;
  thumbnail_url?: string | null;
  name?: string | null;
  description?: string | null;
  category_id?: string | null;
  tags?: string[];
  location_id?: string | null;
  quantity?: number;
  price?: number | null;
  currency?: string;
  purchase_date?: string | null;
  expiration_date?: string | null;
  brand?: string | null;
  model?: string | null;
  notes?: string | null;
  is_favorite?: boolean;
  keep_forever?: boolean;
  ai_metadata?: ItemAIMetadata | null;
}

export interface UpdateItemRequest {
  name?: string | null;
  description?: string | null;
  category_id?: string | null;
  tags?: string[];
  location_id?: string | null;
  quantity?: number;
  price?: number | null;
  currency?: string;
  purchase_date?: string | null;
  expiration_date?: string | null;
  brand?: string | null;
  model?: string | null;
  notes?: string | null;
  is_favorite?: boolean;
  keep_forever?: boolean;
}

export type ItemResponse = Item;

export type ItemsResponse = Item[];

/**
 * Item with related data for display
 */
export interface ItemWithRelations extends Item {
  category: Category | null;
  location: Location | null;
}

/**
 * Item list filters
 */
export interface ItemFilters {
  category_ids?: string[];
  location_id?: string;
  is_favorite?: boolean;
  has_expiration?: boolean;
  expiring_within_days?: number;
  search_query?: string;
}

/**
 * Item list sort options
 */
export type ItemSortOption =
  | 'newest'
  | 'oldest'
  | 'az'
  | 'za'
  | 'expiring'
  | 'viewed';

export interface ItemListParams {
  filters?: ItemFilters;
  sort?: ItemSortOption;
  page?: number;
  pageSize?: number;
}

// ============================================
// Notification Request/Response Types
// ============================================

export interface MarkNotificationReadRequest {
  notification_ids: string[];
}

export type NotificationResponse = Notification;

export type NotificationsResponse = Notification[];

/**
 * Notification with related item data
 */
export interface NotificationWithItem extends Notification {
  item: Pick<Item, 'id' | 'name' | 'photo_url' | 'thumbnail_url'> | null;
}

// ============================================
// AI Analysis Request/Response Types
// ============================================

/**
 * Detected item from AI image analysis
 */
export interface DetectedItem {
  name: string;
  category_suggestion: string | null;
  tags: string[];
  brand: string | null;
  confidence: number;
  bbox?: [number, number, number, number];
  thumbnail_url?: string | null;
  thumbnail_path?: string | null;
}

export interface AnalyzeImageRequest {
  image_url: string;
}

export interface AnalyzeImageResponse {
  detected_items: DetectedItem[];
  analysis_model: string;
  analyzed_at: string;
}

/**
 * Shopping assistant analysis result
 */
export interface SimilarItem {
  id: string;
  name: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  location_path: string | null;
  similarity: number;
}

export interface ShoppingAnalyzeRequest {
  image_url: string;
}

/**
 * Shopping usage tracking
 */
export interface ShoppingUsage {
  photo_count: number;
  photo_limit: number;
  text_count?: number;
  text_limit?: number;
}

export interface ShoppingAnalyzeResponse {
  detected_item: DetectedItem | null;
  similar_items: SimilarItem[];
  advice: string | null;
  analyzed_at: string;
  usage: ShoppingUsage;
}

/**
 * Shopping assistant follow-up message (for conversation context)
 */
export interface ShoppingConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'image' | 'analysis';
  imageUrl?: string;
  analysisData?: {
    detected_item?: DetectedItem | null;
    similar_items?: Array<{
      name: string | null;
      similarity: number;
    }>;
  };
}

/**
 * Shopping assistant follow-up request
 */
export interface ShoppingFollowupRequest {
  message: string;
  conversation_history: ShoppingConversationMessage[];
}

/**
 * Shopping assistant follow-up response
 */
export interface ShoppingFollowupResponse {
  response: string;
  responded_at: string;
  usage: {
    text_count: number;
    text_limit: number;
  };
}

// ============================================
// Embedding Request/Response Types
// ============================================

export interface GenerateEmbeddingRequest {
  item_id: string;
}

export interface GenerateEmbeddingResponse {
  item_id: string;
  embedding_generated: boolean;
}

// ============================================
// Dashboard Stats Types
// ============================================

export interface DashboardStats {
  total_items: number;
  total_locations: number;
  expiring_count: number;
  unread_notifications: number;
}

export interface ExpiringItem {
  id: string;
  name: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  expiration_date: string;
  days_remaining: number;
}

export interface RecentItem {
  id: string;
  name: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
  created_at: string;
}

// ============================================
// Search Types
// ============================================

export interface SearchResult {
  id: string;
  name: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
  location_path: string | null;
  match_field: 'name' | 'description' | 'tags' | 'brand' | 'category' | 'location';
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  total_count: number;
}

// ============================================
// Image Upload Types
// ============================================

export interface ImageUploadResult {
  url: string;
  thumbnail_url: string | null;
  file_name: string;
  file_size: number;
}

export interface ImageValidationError {
  code: 'INVALID_FORMAT' | 'FILE_TOO_LARGE' | 'DIMENSIONS_TOO_SMALL';
  message: string;
}
