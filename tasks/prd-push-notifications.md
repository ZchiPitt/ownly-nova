# PRD: Push Notification System

## Introduction

Implement a comprehensive push notification system for Ownly that enables real-time communication between marketplace users and timely item reminders. This builds upon existing infrastructure including the messages table, notifications table, push_subscriptions table, and Supabase Realtime.

**Key Problem:** Users miss important marketplace communications (chat messages, transaction updates) and item reminders (expiry, warranty) when not actively using the app.

**Existing Infrastructure:**
- Database: `messages`, `notifications`, `push_subscriptions`, `user_settings` tables
- Real-time: Supabase Realtime subscriptions for chat (useMessages hook)
- In-app: MessagesPage, ChatPage, NotificationsPage, useNotifications hook
- Push: usePushNotifications hook for permission/subscription management

**Missing Pieces:**
- Edge function to actually send Web Push notifications
- Database triggers to fire on notification insert
- Online presence detection to avoid redundant pushes
- Enhanced notification center with categorized tabs
- Complete notification preferences UI

## Goals

- Deliver push notifications within 30 seconds of triggering event
- Support 5 notification categories: chat messages, transaction status, item expiry, warranty expiry, custom reminders
- Allow per-category notification controls
- Prevent duplicate/redundant notifications when user is actively viewing
- Display unread counts with proper badge management
- Work across all supported platforms (Chrome, Firefox, Safari, mobile browsers)

## User Stories

### Epic 1: Push Notification Delivery Infrastructure

#### US-001: Create send-push-notification Edge Function
**Description:** As a system, I need to send Web Push notifications when notifications are created, so users receive timely alerts outside the app.

**Acceptance Criteria:**
- [ ] Create `supabase/functions/send-push-notification/index.ts` Edge Function
- [ ] Function accepts notification payload: `{ user_id, title, body, data, type }`
- [ ] Function queries `push_subscriptions` for user's active subscriptions
- [ ] Function sends Web Push using web-push library with VAPID keys
- [ ] Function handles multiple devices per user (send to all active subscriptions)
- [ ] Function returns success/failure status for each subscription
- [ ] Function removes invalid subscriptions (expired/unsubscribed) from database
- [ ] Add VAPID_PRIVATE_KEY to Supabase secrets
- [ ] Typecheck passes

#### US-002: Create database trigger for notification push delivery
**Description:** As a system, I need to automatically trigger push delivery when notifications are created, so pushes happen without manual intervention.

**Acceptance Criteria:**
- [ ] Create migration with `pg_net` HTTP extension enabled
- [ ] Create database function `trigger_push_notification()` that calls Edge Function
- [ ] Create trigger `on_notification_insert` on `notifications` table for INSERT events
- [ ] Trigger only fires when `is_pushed = false`
- [ ] Trigger passes notification id, user_id, type, title, body, data to Edge Function
- [ ] Edge Function updates `is_pushed = true` and `pushed_at = now()` after successful delivery
- [ ] Typecheck passes

#### US-003: Add user presence tracking for smart push suppression
**Description:** As a user viewing a conversation, I don't want to receive push notifications for that conversation, so I'm not disturbed by redundant alerts.

**Acceptance Criteria:**
- [ ] Create `user_presence` table: `user_id`, `active_listing_id`, `last_seen`, `updated_at`
- [ ] Add RLS policies for users to manage their own presence
- [ ] Update ChatPage to call presence update on mount/unmount
- [ ] Create `usePresence` hook with `setActiveConversation(listingId)` and `clearPresence()`
- [ ] Update `trigger_push_notification` to check presence before sending
- [ ] Skip push if user was active on that listing_id within last 30 seconds
- [ ] Typecheck passes

### Epic 2: Chat Message Notifications

#### US-004: Implement real-time chat push notifications
**Description:** As a marketplace user, I want to receive push notifications for new chat messages, so I can respond quickly to buyers/sellers.

**Acceptance Criteria:**
- [ ] `new_message` notification type triggers push notification
- [ ] Push title: "New message from {sender_name}"
- [ ] Push body: Message preview (first 50 characters) + "..." if truncated
- [ ] Push data includes: `{ type: 'new_message', listing_id, sender_id }`
- [ ] Clicking notification opens `/messages/{listing_id}`
- [ ] Service worker handles notification click with correct navigation
- [ ] Typecheck passes

#### US-005: Implement message batching for rapid messages
**Description:** As a user, I don't want to be spammed with notifications when someone sends multiple messages quickly, so I receive consolidated alerts.

**Acceptance Criteria:**
- [ ] Create `pending_push_notifications` table for batching queue
- [ ] Messages from same sender within 5 seconds are batched
- [ ] Batched notification shows: "{sender} sent {n} messages"
- [ ] Implement scheduled function to process batching queue every 5 seconds
- [ ] Clear pending batch when user views conversation
- [ ] Typecheck passes

### Epic 3: Transaction Status Notifications

#### US-006: Implement transaction status push notifications
**Description:** As a marketplace participant, I want push notifications for transaction status changes, so I know when action is needed.

**Acceptance Criteria:**
- [ ] `new_inquiry` → Push: "New inquiry from {buyer}" / "{item_name}"
- [ ] `purchase_request` → Push: "{buyer} wants to buy {item_name}"
- [ ] `request_accepted` → Push: "{seller} accepted your request for {item_name}"
- [ ] `request_declined` → Push: "{seller} declined your request"
- [ ] `transaction_complete` → Push: "Transaction complete! Leave a review"
- [ ] All transaction pushes include `listing_id` in data for deep linking
- [ ] Clicking notification opens appropriate page (listing detail or messages)
- [ ] Typecheck passes

### Epic 4: Item Reminder Notifications

#### US-007: Add warranty_expiring notification type
**Description:** As a user with warranted items, I want warranty expiry reminders, so I can take action before warranty expires.

**Acceptance Criteria:**
- [ ] Add `warranty_expiring` to notifications type constraint via migration
- [ ] Add `warranty_reminder_days` column to `user_settings` (default: 30)
- [ ] Add `warranty_reminder_enabled` column to `user_settings` (default: true)
- [ ] Typecheck passes

#### US-008: Update generate-reminders Edge Function for warranty alerts
**Description:** As a system, I need to generate warranty expiry reminders, so users are alerted before warranties expire.

**Acceptance Criteria:**
- [ ] Update `generate-reminders` function to check `items.warranty_expiry_date`
- [ ] Generate reminder N days before expiry (per user setting)
- [ ] Notification title: "Warranty expiring soon"
- [ ] Notification body: "{item_name} warranty expires on {date}"
- [ ] Prevent duplicate reminders for same item/expiry combination
- [ ] Respect user's `warranty_reminder_enabled` setting
- [ ] Typecheck passes

#### US-009: Implement custom reminder push notifications
**Description:** As a user who set a custom reminder, I want to receive a push notification on the reminder date, so I don't forget.

**Acceptance Criteria:**
- [ ] Custom reminders (items.reminder_date) trigger `custom_reminder` notification type
- [ ] Add `custom_reminder` to notifications type constraint
- [ ] Push title: "Reminder: {item_name}"
- [ ] Push body: User's custom reminder note if set, else "You set a reminder for this item"
- [ ] Reminder only fires once (mark item's reminder as sent)
- [ ] Clicking notification opens item detail page
- [ ] Typecheck passes

### Epic 5: Enhanced Notification Center UI

#### US-010: Add tabbed navigation to NotificationsPage
**Description:** As a user, I want to see notifications organized by category (Messages vs Reminders), so I can quickly find what I need.

**Acceptance Criteria:**
- [ ] Add tab bar with "Messages" and "Reminders" tabs
- [ ] "Messages" tab shows: `new_inquiry`, `purchase_request`, `request_accepted`, `request_declined`, `new_message`, `transaction_complete`
- [ ] "Reminders" tab shows: `unused_item`, `expiring_item`, `warranty_expiring`, `custom_reminder`, `system`
- [ ] Persist selected tab in URL param `?tab=messages|reminders`
- [ ] Show unread count badge on each tab
- [ ] Default to "Messages" tab if any unread messages exist, else "Reminders"
- [ ] Typecheck passes
- [ ] Verify in browser that tabs switch correctly and counts display

#### US-011: Implement notification grouping by date
**Description:** As a user, I want notifications grouped by date, so I can understand the timeline.

**Acceptance Criteria:**
- [ ] Group notifications: "Today", "Yesterday", "This Week", "Earlier"
- [ ] Show section headers between groups
- [ ] Maintain chronological order within groups (newest first)
- [ ] Typecheck passes
- [ ] Verify in browser that grouping displays correctly

#### US-012: Add swipe-to-delete for individual notifications
**Description:** As a user, I want to swipe away individual notifications, so I can clean up my notification list.

**Acceptance Criteria:**
- [ ] Implement swipe gesture on notification items (left swipe reveals delete)
- [ ] Show red "Delete" action on swipe
- [ ] Tapping delete removes notification from database
- [ ] Animate removal smoothly
- [ ] Typecheck passes
- [ ] Verify in browser that swipe gesture and delete work

### Epic 6: Notification Settings UI

#### US-013: Create comprehensive notification settings section
**Description:** As a user, I want to control which notifications I receive, so I'm not overwhelmed.

**Acceptance Criteria:**
- [ ] Add "Notifications" section to SettingsPage
- [ ] Master toggle: "Enable Push Notifications" (calls requestPermission/unsubscribe)
- [ ] Show current permission state (granted/denied/default)
- [ ] If denied, show instructions to enable in browser settings
- [ ] Typecheck passes
- [ ] Verify in browser that permission flow works

#### US-014: Add per-category notification toggles
**Description:** As a user, I want to enable/disable specific notification types, so I only get what matters to me.

**Acceptance Criteria:**
- [ ] Section: "Marketplace Notifications" with toggles for:
  - [ ] Chat messages (marketplace_new_message_enabled)
  - [ ] Purchase requests (marketplace_purchase_request_enabled)
  - [ ] Transaction updates (marketplace_request_accepted_enabled, request_declined, transaction_complete)
- [ ] Section: "Item Reminders" with toggles for:
  - [ ] Expiry reminders (expiry_reminder_enabled)
  - [ ] Warranty reminders (warranty_reminder_enabled)
  - [ ] Custom reminders (custom_reminder_enabled - add to user_settings)
- [ ] Toggles immediately update user_settings table
- [ ] Typecheck passes
- [ ] Verify in browser that toggles persist correctly

#### US-015: Add reminder timing configuration
**Description:** As a user, I want to configure how far in advance I receive reminders, so they're useful for my situation.

**Acceptance Criteria:**
- [ ] "Expiry reminder" dropdown: 1 day, 3 days, 7 days, 14 days before
- [ ] "Warranty reminder" dropdown: 7 days, 14 days, 30 days, 60 days before
- [ ] Update user_settings columns on change
- [ ] Show current selection from database
- [ ] Typecheck passes
- [ ] Verify in browser that selections persist

### Epic 7: Service Worker & Click Handling

#### US-016: Enhance service worker for notification handling
**Description:** As a PWA, I need to handle push events and notification clicks properly, so users can interact with notifications.

**Acceptance Criteria:**
- [ ] Update service worker to handle `push` event
- [ ] Parse notification payload and show system notification
- [ ] Use app icon for notification
- [ ] Handle `notificationclick` event
- [ ] Extract `data` from notification for routing
- [ ] Open app to correct URL based on notification type
- [ ] Focus existing tab if app already open, else open new tab
- [ ] Typecheck passes

#### US-017: Implement notification action buttons
**Description:** As a user, I want quick actions on notifications, so I can respond without opening the app.

**Acceptance Criteria:**
- [ ] Chat message notifications show "Reply" action (opens chat)
- [ ] Transaction notifications show "View" action (opens listing)
- [ ] Item reminders show "View Item" action (opens item detail)
- [ ] Service worker handles action clicks with appropriate routing
- [ ] Typecheck passes

### Epic 8: Edge Cases & Polish

#### US-018: Handle notification permission denial gracefully
**Description:** As a user who denied notifications, I want guidance on how to enable them, so I can change my mind later.

**Acceptance Criteria:**
- [ ] Detect `Notification.permission === 'denied'` state
- [ ] Show banner in NotificationsPage explaining notifications are disabled
- [ ] Provide platform-specific instructions (Chrome, Safari, mobile)
- [ ] Link to browser notification settings where possible
- [ ] Typecheck passes
- [ ] Verify in browser that denial state shows correct guidance

#### US-019: Implement notification deduplication
**Description:** As a user, I don't want duplicate notifications for the same event, so my notification list stays clean.

**Acceptance Criteria:**
- [ ] Add `event_key` column to notifications table for deduplication
- [ ] Generate unique key: `{type}:{item_id}:{timestamp_bucket}`
- [ ] Check for existing notification with same event_key before insert
- [ ] Skip insert if duplicate found within 24 hours
- [ ] Typecheck passes

#### US-020: Add notification sound and vibration
**Description:** As a user, I want audible/tactile feedback for important notifications, so I notice them.

**Acceptance Criteria:**
- [ ] High priority notifications (chat, purchase_request) use default sound
- [ ] Medium priority (reminders) use subtle sound
- [ ] Vibration pattern for mobile: chat = short, transaction = double
- [ ] Add "Notification sound" toggle to settings (default: on)
- [ ] Typecheck passes

## Functional Requirements

- FR-1: Push notifications must be delivered within 30 seconds of triggering event
- FR-2: System must support multiple devices per user (send to all active push subscriptions)
- FR-3: Invalid/expired push subscriptions must be automatically cleaned up
- FR-4: User presence tracking must prevent redundant pushes when viewing conversation
- FR-5: Messages from same sender within 5 seconds must be batched into single notification
- FR-6: Each notification type must have configurable enable/disable toggle
- FR-7: Reminder timing (days before) must be configurable per reminder type
- FR-8: Notification clicks must deep-link to correct app location
- FR-9: Notification center must categorize by Messages vs Reminders tabs
- FR-10: All notification operations must respect RLS policies

## Non-Goals

- Native mobile app push (APNs/FCM) - PWA Web Push only
- Rich media in notifications (images, buttons beyond simple actions)
- Scheduled/delayed notifications beyond reminder system
- Notification snooze functionality
- Email notification fallback
- Analytics/tracking of notification engagement rates
- A/B testing of notification content

## Technical Considerations

### Existing Infrastructure to Leverage
- `push_subscriptions` table already exists with `endpoint`, `p256dh`, `auth` columns
- `usePushNotifications` hook handles permission flow and subscription storage
- `notifications` table has `is_pushed`, `pushed_at`, `data` columns ready
- `user_settings` has marketplace notification preferences columns
- Supabase Realtime already used for chat in `useMessages.subscribeToMessages()`

### New Dependencies
- `web-push` npm package for Edge Function (or use fetch with VAPID signing)
- `pg_net` Postgres extension for HTTP calls from triggers

### Database Changes Required
- Add `user_presence` table for online status tracking
- Add `pending_push_notifications` table for batching queue
- Add `warranty_expiring`, `custom_reminder` to notification types
- Add `warranty_reminder_days`, `warranty_reminder_enabled`, `custom_reminder_enabled` to user_settings
- Add `event_key` column to notifications for deduplication

### Performance Considerations
- Use database trigger + pg_net for fastest push delivery
- Batch rapid messages to reduce notification spam
- Index `user_presence.user_id` and `user_presence.active_listing_id`
- Consider edge caching for user notification preferences

## Success Metrics

- Push notification delivery latency < 30 seconds (p95)
- Zero duplicate pushes for same event
- Users actively viewing conversation receive 0 pushes for that conversation
- Notification click-through opens correct page 100% of time
- All notification preference changes take effect immediately

## Open Questions

1. Should we implement "quiet hours" for non-urgent notifications?
2. Should batched messages show preview of all messages or just count?
3. Should warranty reminders send multiple reminders (30 days, 7 days, 1 day) or just one?
4. Should notification grouping collapse old notifications automatically?
