/**
 * Supabase Edge Function: generate-reminders
 *
 * Background job to generate reminder notifications for users.
 * Intended to be triggered daily via pg_cron, Supabase scheduled functions,
 * or external scheduler (e.g., GitHub Actions, cron.org).
 *
 * This function:
 * 1. Finds users with reminder_enabled = true
 * 2. For each user, finds unused items (not viewed within threshold)
 * 3. For each user, finds expiring items (within their configured days)
 * 4. Creates notification records (preventing duplicates)
 * 5. Marks notifications as needing push if push is enabled
 *
 * @requires SUPABASE_URL environment variable
 * @requires SUPABASE_SERVICE_ROLE_KEY environment variable (for bypassing RLS)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Types
interface UserSettings {
  user_id: string;
  reminder_enabled: boolean;
  reminder_threshold_days: number;
  expiration_reminder_days: number;
  push_notifications_enabled: boolean;
  warranty_reminder_enabled: boolean;
  warranty_reminder_days: number;
  custom_reminder_enabled?: boolean; // Optional, defaults to true if not present
}

interface Item {
  id: string;
  user_id: string;
  name: string | null;
  last_viewed_at: string | null;
  expiration_date: string | null;
  warranty_expiry_date: string | null;
  reminder_date: string | null;
  reminder_note: string | null;
  reminder_sent: boolean;
  keep_forever: boolean;
  deleted_at: string | null;
}

interface NotificationInsert {
  user_id: string;
  type: 'unused_item' | 'expiring_item' | 'warranty_expiring' | 'custom_reminder';
  title: string;
  body: string;
  item_id: string;
}

interface GenerateRemindersResponse {
  success: boolean;
  users_processed: number;
  unused_notifications_created: number;
  expiring_notifications_created: number;
  warranty_notifications_created: number;
  custom_reminder_notifications_created: number;
  errors: string[];
  executed_at: string;
}

interface ApiError {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Calculate days difference between two dates
 */
function daysDifference(date1: Date, date2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((date2.getTime() - date1.getTime()) / msPerDay);
}

/**
 * Format a friendly time description
 */
function formatDaysAgo(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
  return `over a year ago`;
}

/**
 * Format days until expiration
 */
function formatDaysUntil(days: number): string {
  if (days < 0) return `expired ${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} ago`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} day${days > 1 ? 's' : ''}`;
}

/**
 * Format a date in a user-friendly format (e.g., "February 15, 2026")
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Main handler for the Edge Function
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      const error: ApiError = {
        error: {
          message: 'Supabase configuration missing',
          code: 'CONFIGURATION_ERROR',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Optional: Validate secret key for external schedulers
    // This provides basic protection against unauthorized triggers
    const secretKey = Deno.env.get('REMINDER_SECRET_KEY');
    if (secretKey) {
      const providedKey = req.headers.get('X-Reminder-Secret');
      if (providedKey !== secretKey) {
        const error: ApiError = {
          error: {
            message: 'Invalid secret key',
            code: 'UNAUTHORIZED',
          },
        };
        return new Response(JSON.stringify(error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const response: GenerateRemindersResponse = {
      success: true,
      users_processed: 0,
      unused_notifications_created: 0,
      expiring_notifications_created: 0,
      warranty_notifications_created: 0,
      custom_reminder_notifications_created: 0,
      errors: [],
      executed_at: now.toISOString(),
    };

    // Step 1: Get all users with reminders enabled (includes warranty and custom reminder settings)
    // Note: We query all users with any reminder type enabled
    const { data: usersWithReminders, error: usersError } = await supabase
      .from('user_settings')
      .select('user_id, reminder_enabled, reminder_threshold_days, expiration_reminder_days, push_notifications_enabled, warranty_reminder_enabled, warranty_reminder_days, custom_reminder_enabled')
      .or('reminder_enabled.eq.true,warranty_reminder_enabled.eq.true');

    if (usersError) {
      throw new Error(`Failed to fetch user settings: ${usersError.message}`);
    }

    if (!usersWithReminders || usersWithReminders.length === 0) {
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userSettings = usersWithReminders as UserSettings[];
    response.users_processed = userSettings.length;

    // Process each user
    for (const settings of userSettings) {
      try {
        const notificationsToCreate: NotificationInsert[] = [];

        // Step 2: Find unused items for this user
        const thresholdDate = new Date(now);
        thresholdDate.setDate(thresholdDate.getDate() - settings.reminder_threshold_days);

        const { data: unusedItems, error: unusedError } = await supabase
          .from('items')
          .select('id, user_id, name, last_viewed_at')
          .eq('user_id', settings.user_id)
          .eq('keep_forever', false)
          .is('deleted_at', null)
          .or(`last_viewed_at.is.null,last_viewed_at.lt.${thresholdDate.toISOString()}`);

        if (unusedError) {
          response.errors.push(`User ${settings.user_id}: Failed to fetch unused items - ${unusedError.message}`);
        } else if (unusedItems && unusedItems.length > 0) {
          // Check for existing notifications to prevent duplicates
          const unusedItemIds = unusedItems.map(item => item.id);
          const { data: existingUnusedNotifications } = await supabase
            .from('notifications')
            .select('item_id')
            .eq('user_id', settings.user_id)
            .eq('type', 'unused_item')
            .in('item_id', unusedItemIds)
            .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Within last 7 days

          const existingUnusedItemIds = new Set(
            existingUnusedNotifications?.map(n => n.item_id) || []
          );

          for (const item of unusedItems as Item[]) {
            // Skip if notification already exists for this item within 7 days
            if (existingUnusedItemIds.has(item.id)) {
              continue;
            }

            const itemName = item.name || 'Unnamed item';
            const lastViewedDate = item.last_viewed_at ? new Date(item.last_viewed_at) : null;
            const daysUnused = lastViewedDate
              ? daysDifference(lastViewedDate, now)
              : settings.reminder_threshold_days; // If never viewed, use threshold

            notificationsToCreate.push({
              user_id: settings.user_id,
              type: 'unused_item',
              title: `Haven't used "${itemName}" lately?`,
              body: `You last viewed this item ${formatDaysAgo(daysUnused)}. Consider using it or deciding if you still need it.`,
              item_id: item.id,
            });
          }
        }

        // Step 3: Find expiring items for this user
        const expirationThreshold = new Date(now);
        expirationThreshold.setDate(expirationThreshold.getDate() + settings.expiration_reminder_days);

        const { data: expiringItems, error: expiringError } = await supabase
          .from('items')
          .select('id, user_id, name, expiration_date')
          .eq('user_id', settings.user_id)
          .is('deleted_at', null)
          .not('expiration_date', 'is', null)
          .lte('expiration_date', expirationThreshold.toISOString().split('T')[0])
          .gte('expiration_date', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // Include items expired within last 7 days

        if (expiringError) {
          response.errors.push(`User ${settings.user_id}: Failed to fetch expiring items - ${expiringError.message}`);
        } else if (expiringItems && expiringItems.length > 0) {
          // Check for existing notifications to prevent duplicates
          const expiringItemIds = expiringItems.map(item => item.id);
          const { data: existingExpiringNotifications } = await supabase
            .from('notifications')
            .select('item_id')
            .eq('user_id', settings.user_id)
            .eq('type', 'expiring_item')
            .in('item_id', expiringItemIds)
            .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()); // Within last 24 hours

          const existingExpiringItemIds = new Set(
            existingExpiringNotifications?.map(n => n.item_id) || []
          );

          for (const item of expiringItems as Item[]) {
            // Skip if notification already exists for this item within 24 hours
            if (existingExpiringItemIds.has(item.id)) {
              continue;
            }

            const itemName = item.name || 'Unnamed item';
            const expirationDate = new Date(item.expiration_date!);
            const daysUntilExpiration = daysDifference(now, expirationDate);

            notificationsToCreate.push({
              user_id: settings.user_id,
              type: 'expiring_item',
              title: daysUntilExpiration < 0
                ? `"${itemName}" has expired!`
                : `"${itemName}" expires ${formatDaysUntil(daysUntilExpiration)}`,
              body: daysUntilExpiration < 0
                ? `This item expired ${formatDaysAgo(Math.abs(daysUntilExpiration))}. Check if it's still usable.`
                : `Remember to use this item before it expires ${formatDaysUntil(daysUntilExpiration)}.`,
              item_id: item.id,
            });
          }
        }

        // Step 3b: Find warranty expiring items for this user (if warranty reminders enabled)
        if (settings.warranty_reminder_enabled) {
          const warrantyThreshold = new Date(now);
          warrantyThreshold.setDate(warrantyThreshold.getDate() + settings.warranty_reminder_days);

          const { data: warrantyItems, error: warrantyError } = await supabase
            .from('items')
            .select('id, user_id, name, warranty_expiry_date')
            .eq('user_id', settings.user_id)
            .is('deleted_at', null)
            .not('warranty_expiry_date', 'is', null)
            .lte('warranty_expiry_date', warrantyThreshold.toISOString().split('T')[0])
            .gte('warranty_expiry_date', now.toISOString().split('T')[0]); // Only future warranty expirations

          if (warrantyError) {
            response.errors.push(`User ${settings.user_id}: Failed to fetch warranty items - ${warrantyError.message}`);
          } else if (warrantyItems && warrantyItems.length > 0) {
            // Check for existing warranty notifications to prevent duplicates
            // Use a 7-day window to prevent spam for same item/expiry
            const warrantyItemIds = warrantyItems.map(item => item.id);
            const { data: existingWarrantyNotifications } = await supabase
              .from('notifications')
              .select('item_id')
              .eq('user_id', settings.user_id)
              .eq('type', 'warranty_expiring')
              .in('item_id', warrantyItemIds)
              .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Within last 7 days

            const existingWarrantyItemIds = new Set(
              existingWarrantyNotifications?.map(n => n.item_id) || []
            );

            for (const item of warrantyItems as Item[]) {
              // Skip if notification already exists for this item within 7 days
              if (existingWarrantyItemIds.has(item.id)) {
                continue;
              }

              const itemName = item.name || 'Unnamed item';
              const warrantyDate = new Date(item.warranty_expiry_date!);

              notificationsToCreate.push({
                user_id: settings.user_id,
                type: 'warranty_expiring',
                title: 'Warranty expiring soon',
                body: `${itemName} warranty expires on ${formatDate(warrantyDate)}`,
                item_id: item.id,
              });
            }
          }
        }

        // Step 3c: Find items with custom reminders that are due today
        // Custom reminders are enabled by default if the setting doesn't exist
        const customReminderEnabled = settings.custom_reminder_enabled !== false;
        if (customReminderEnabled) {
          const todayStr = now.toISOString().split('T')[0];

          const { data: reminderItems, error: reminderError } = await supabase
            .from('items')
            .select('id, user_id, name, reminder_date, reminder_note, reminder_sent')
            .eq('user_id', settings.user_id)
            .is('deleted_at', null)
            .eq('reminder_sent', false)
            .not('reminder_date', 'is', null)
            .lte('reminder_date', todayStr); // Due today or overdue

          if (reminderError) {
            response.errors.push(`User ${settings.user_id}: Failed to fetch reminder items - ${reminderError.message}`);
          } else if (reminderItems && reminderItems.length > 0) {
            // Track items to mark as sent after notification creation
            const itemsToMarkSent: string[] = [];

            for (const item of reminderItems as Item[]) {
              const itemName = item.name || 'Unnamed item';
              const reminderBody = item.reminder_note || 'You set a reminder for this item';

              notificationsToCreate.push({
                user_id: settings.user_id,
                type: 'custom_reminder',
                title: `Reminder: ${itemName}`,
                body: reminderBody,
                item_id: item.id,
              });
              itemsToMarkSent.push(item.id);
            }

            // Mark items as reminder_sent = true to prevent re-triggering
            if (itemsToMarkSent.length > 0) {
              const { error: updateError } = await supabase
                .from('items')
                .update({ reminder_sent: true })
                .in('id', itemsToMarkSent);

              if (updateError) {
                response.errors.push(`User ${settings.user_id}: Failed to mark reminders as sent - ${updateError.message}`);
              }
            }
          }
        }

        // Step 4: Insert notifications in batch
        if (notificationsToCreate.length > 0) {
          const { data: insertedNotifications, error: insertError } = await supabase
            .from('notifications')
            .insert(notificationsToCreate)
            .select('id, type');

          if (insertError) {
            response.errors.push(`User ${settings.user_id}: Failed to insert notifications - ${insertError.message}`);
          } else if (insertedNotifications) {
            const unusedCount = insertedNotifications.filter(n => n.type === 'unused_item').length;
            const expiringCount = insertedNotifications.filter(n => n.type === 'expiring_item').length;
            const warrantyCount = insertedNotifications.filter(n => n.type === 'warranty_expiring').length;
            const customReminderCount = insertedNotifications.filter(n => n.type === 'custom_reminder').length;
            response.unused_notifications_created += unusedCount;
            response.expiring_notifications_created += expiringCount;
            response.warranty_notifications_created += warrantyCount;
            response.custom_reminder_notifications_created += customReminderCount;
          }
        }

      } catch (userError) {
        const errorMessage = userError instanceof Error ? userError.message : 'Unknown error';
        response.errors.push(`User ${settings.user_id}: ${errorMessage}`);
      }
    }

    // Mark as failed if there were critical errors
    if (response.errors.length > response.users_processed / 2) {
      response.success = false;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('generate-reminders error:', error);

    const apiError: ApiError = {
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      },
    };

    return new Response(JSON.stringify(apiError), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
