/**
 * TypeScript types for Ownly database entities
 * Generated from Supabase schema migrations
 */

// ============================================
// Entity Interfaces - match database schema
// ============================================

/**
 * User profile extending auth.users
 * Table: profiles
 */
export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location_city: string | null;
  seller_rating: number | null;
  review_count: number;
  is_verified: boolean;
  total_sold: number;
  response_rate: number | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * User personalization preferences
 * Table: user_settings
 */
export interface UserSettings {
  id: string;
  user_id: string;
  reminder_enabled: boolean;
  reminder_threshold_days: number;
  expiration_reminder_days: number;
  push_notifications_enabled: boolean;
  notification_sound_enabled: boolean;
  marketplace_new_inquiry_enabled: boolean;
  marketplace_purchase_request_enabled: boolean;
  marketplace_request_accepted_enabled: boolean;
  marketplace_request_declined_enabled: boolean;
  marketplace_new_message_enabled: boolean;
  marketplace_transaction_complete_enabled: boolean;
  warranty_reminder_days: number;
  warranty_reminder_enabled: boolean;
  custom_reminder_enabled: boolean;
  default_view: 'gallery' | 'list';
  created_at: string;
  updated_at: string;
}

/**
 * Category for organizing inventory items
 * Table: categories
 */
export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  icon: string;
  color: string;
  is_system: boolean;
  sort_order: number;
  created_at: string;
}

/**
 * Storage location with hierarchical support
 * Table: locations
 */
export interface Location {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  path: string;
  depth: number;
  icon: string;
  photo_url: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * AI metadata stored with items
 * Flexible JSON structure for AI analysis results
 */
export interface ItemAIMetadata {
  detected_name?: string;
  detected_category?: string;
  detected_tags?: string[];
  detected_brand?: string;
  confidence_score?: number;
  analysis_provider?: string;
  analysis_model?: string;
  analyzed_at?: string;
  detected_bbox?: [number, number, number, number]; // [x%, y%, width%, height%]
  [key: string]: unknown;
}

/**
 * Core inventory item
 * Table: items
 */
export interface Item {
  id: string;
  user_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  name: string | null;
  description: string | null;
  category_id: string | null;
  tags: string[];
  location_id: string | null;
  quantity: number;
  price: number | null;
  currency: string;
  purchase_date: string | null;
  expiration_date: string | null;
  warranty_expiry_date: string | null;
  reminder_date: string | null;
  reminder_note: string | null;
  reminder_sent: boolean;
  brand: string | null;
  model: string | null;
  notes: string | null;
  is_favorite: boolean;
  keep_forever: boolean;
  ai_metadata: ItemAIMetadata | null;
  embedding?: number[] | null; // vector(1536) - pgvector
  source_batch_id: string | null;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Notification type enum
 */
export type NotificationType =
  | 'unused_item'
  | 'expiring_item'
  | 'warranty_expiring'
  | 'custom_reminder'
  | 'system'
  | 'new_inquiry'
  | 'purchase_request'
  | 'request_accepted'
  | 'request_declined'
  | 'new_message'
  | 'transaction_complete';

export interface NotificationData {
  listing_id?: string;
  transaction_id?: string;
  sender_id?: string;
  sender_name?: string;
  item_name?: string;
}

/**
 * User notification
 * Table: notifications
 */
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  item_id: string | null;
  data: NotificationData | null;
  is_read: boolean;
  is_pushed: boolean;
  pushed_at: string | null;
  event_key: string | null;
  created_at: string;
}

/**
 * Web Push subscription endpoint
 * Table: push_subscriptions
 */
export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_name: string | null;
  user_agent: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

/**
 * User presence tracking for smart push suppression
 * Table: user_presence
 */
export interface UserPresence {
  id: string;
  user_id: string;
  active_listing_id: string | null;
  last_seen: string;
  updated_at: string;
}

/**
 * Pending push notification for message batching
 * Table: pending_push_notifications
 */
export interface PendingPushNotification {
  id: string;
  user_id: string;
  sender_id: string;
  sender_name: string | null;
  listing_id: string;
  item_name: string | null;
  message_count: number;
  first_message_preview: string | null;
  first_message_at: string;
  last_message_at: string;
  created_at: string;
}

/**
 * Marketplace listing status enum
 */
export type ListingStatus = 'active' | 'sold' | 'reserved' | 'removed';

/**
 * Marketplace listing price type enum
 */
export type PriceType = 'fixed' | 'negotiable' | 'free';

/**
 * Marketplace item condition enum
 */
export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';

/**
 * Marketplace transaction status enum
 */
export type TransactionStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';

/**
 * Marketplace listing
 * Table: listings
 */
export interface Listing {
  id: string;
  item_id: string;
  seller_id: string;
  status: ListingStatus;
  price: number | null;
  price_type: PriceType;
  condition: ItemCondition;
  description: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Marketplace transaction
 * Table: transactions
 */
export interface Transaction {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: TransactionStatus;
  agreed_price: number | null;
  message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Marketplace review
 * Table: reviews
 */
export interface Review {
  id: string;
  transaction_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

/**
 * Marketplace message
 * Table: messages
 */
export interface Message {
  id: string;
  listing_id: string | null;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

// ============================================
// Supabase Database Type Definition
// For use with createClient<Database>()
// ============================================

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Profile, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      user_settings: {
        Row: UserSettings;
        Insert: Omit<UserSettings, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          reminder_enabled?: boolean;
          reminder_threshold_days?: number;
          expiration_reminder_days?: number;
          push_notifications_enabled?: boolean;
          notification_sound_enabled?: boolean;
          marketplace_new_inquiry_enabled?: boolean;
          marketplace_purchase_request_enabled?: boolean;
          marketplace_request_accepted_enabled?: boolean;
          marketplace_request_declined_enabled?: boolean;
          marketplace_new_message_enabled?: boolean;
          marketplace_transaction_complete_enabled?: boolean;
          warranty_reminder_days?: number;
          warranty_reminder_enabled?: boolean;
          custom_reminder_enabled?: boolean;
          default_view?: 'gallery' | 'list';
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<UserSettings, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id' | 'created_at'> & {
          id?: string;
          icon?: string;
          color?: string;
          is_system?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Omit<Category, 'id' | 'user_id' | 'created_at' | 'is_system'>>;
        Relationships: [];
      };
      locations: {
        Row: Location;
        Insert: Omit<Location, 'id' | 'path' | 'depth' | 'item_count' | 'created_at' | 'updated_at' | 'deleted_at'> & {
          id?: string;
          path?: string;
          depth?: number;
          icon?: string;
          item_count?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<Location, 'id' | 'user_id' | 'created_at' | 'path' | 'depth' | 'item_count'>>;
        Relationships: [];
      };
      items: {
        Row: Item;
        Insert: {
          user_id: string;
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
          warranty_expiry_date?: string | null;
          reminder_date?: string | null;
          reminder_note?: string | null;
          reminder_sent?: boolean;
          brand?: string | null;
          model?: string | null;
          notes?: string | null;
          is_favorite?: boolean;
          keep_forever?: boolean;
          ai_metadata?: ItemAIMetadata | null;
          source_batch_id?: string | null;
          last_viewed_at?: string | null;
          id?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<Item, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at' | 'event_key'> & {
          id?: string;
          is_read?: boolean;
          is_pushed?: boolean;
          event_key?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          body?: string | null;
          item_id?: string | null;
          data?: NotificationData | null;
          is_read?: boolean;
          is_pushed?: boolean;
          pushed_at?: string | null;
          event_key?: string | null;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscription;
        Insert: {
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          id?: string;
          device_name?: string | null;
          user_agent?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          last_used_at?: string | null;
        };
        Update: {
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          device_name?: string | null;
          user_agent?: string | null;
          is_active?: boolean;
          updated_at?: string;
          last_used_at?: string | null;
        };
        Relationships: [];
      };
      user_presence: {
        Row: UserPresence;
        Insert: {
          user_id: string;
          id?: string;
          active_listing_id?: string | null;
          last_seen?: string;
          updated_at?: string;
        };
        Update: {
          active_listing_id?: string | null;
          last_seen?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pending_push_notifications: {
        Row: PendingPushNotification;
        Insert: {
          user_id: string;
          sender_id: string;
          listing_id: string;
          id?: string;
          sender_name?: string | null;
          item_name?: string | null;
          message_count?: number;
          first_message_preview?: string | null;
          first_message_at?: string;
          last_message_at?: string;
          created_at?: string;
        };
        Update: {
          sender_name?: string | null;
          item_name?: string | null;
          message_count?: number;
          first_message_preview?: string | null;
          last_message_at?: string;
        };
        Relationships: [];
      };
      listings: {
        Row: Listing;
        Insert: {
          item_id: string;
          seller_id: string;
          status?: ListingStatus;
          price?: number | null;
          price_type?: PriceType;
          condition: ItemCondition;
          description?: string | null;
          view_count?: number;
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Listing, 'id' | 'item_id' | 'seller_id' | 'created_at'>>;
        Relationships: [];
      };
      transactions: {
        Row: Transaction;
        Insert: {
          listing_id: string;
          buyer_id: string;
          seller_id: string;
          status?: TransactionStatus;
          agreed_price?: number | null;
          message?: string | null;
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Transaction, 'id' | 'listing_id' | 'buyer_id' | 'seller_id' | 'created_at'>>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: {
          listing_id?: string | null;
          sender_id: string;
          receiver_id: string;
          content: string;
          read_at?: string | null;
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Message, 'id' | 'listing_id' | 'sender_id' | 'receiver_id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_similar_items: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
        };
        Returns: Array<{
          id: string;
          name: string | null;
          description: string | null;
          photo_url: string;
          thumbnail_url: string | null;
          category_id: string | null;
          location_id: string | null;
          similarity: number;
        }>;
      };
      search_items_by_embedding: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
          search_user_id?: string | null;
        };
        Returns: Array<{
          id: string;
          name: string | null;
          description: string | null;
          photo_url: string;
          thumbnail_url: string | null;
          category_id: string | null;
          location_id: string | null;
          similarity: number;
        }>;
      };
      soft_delete_item: {
        Args: {
          item_id: string;
        };
        Returns: void;
      };
      restore_item: {
        Args: {
          item_id: string;
        };
        Returns: void;
      };
    };
    Enums: {
      notification_type: NotificationType;
    };
  };
};

// ============================================
// Utility Types
// ============================================

/**
 * Extract row type from a table name
 */
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

/**
 * Extract insert type from a table name
 */
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

/**
 * Extract update type from a table name
 */
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
