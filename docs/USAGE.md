# Ownly User Guide

**Ownly** is a smart home inventory app that helps you track your belongings through AI-powered photo recognition. Never forget where you stored something again!

## Table of Contents

- [Getting Started](#getting-started)
- [Adding Items](#adding-items)
- [Browsing Your Inventory](#browsing-your-inventory)
- [Searching for Items](#searching-for-items)
- [Managing Items](#managing-items)
- [Shopping Assistant](#shopping-assistant)
- [Settings & Preferences](#settings--preferences)

---

## Getting Started

### Installation

**Web:** Visit the app URL in your browser.

**Mobile (PWA):**
- **Android/Chrome:** Tap the install banner that appears after browsing for a few seconds
- **iOS Safari:** Tap the Share icon, then "Add to Home Screen"

### Account Setup

1. Open the app and tap **Sign Up**
2. Enter your email and create a password (min. 8 characters)
3. You'll be automatically logged in and taken to your Dashboard

---

## Adding Items

The fastest way to build your inventory is with AI-powered photo recognition.

### Step 1: Take or Choose a Photo

1. Tap the **+** button in the bottom navigation
2. Choose **Take Photo** to use your camera, or **Choose from Gallery**
3. Preview your photo and tap **Continue** (or **Retake** if needed)

### Step 2: AI Analysis

The AI will analyze your photo to identify:
- **Item name** (e.g., "Blue Coffee Mug")
- **Category** (e.g., Kitchen)
- **Tags** (e.g., #mug #ceramic #kitchen)
- **Brand** (if visible)

This usually takes 5-15 seconds.

### Step 3: Review & Edit

Review the AI suggestions and adjust as needed:

| Field | Description |
|-------|-------------|
| **Name** | Item name (max 200 characters) |
| **Quantity** | How many you have (1-999) |
| **Category** | Choose from system or custom categories |
| **Location** | Where it's stored (e.g., Home > Kitchen > Pantry) |
| **Tags** | Add custom labels for easy searching |
| **Description** | Add notes about the item |
| **Price** | Purchase price with currency |
| **Dates** | Purchase date and/or expiration date |
| **Brand/Model** | Manufacturer information |

### Step 4: Save

Tap **Save Item** to add to your inventory. The item will appear in your Recently Added list.

---

## Browsing Your Inventory

### Dashboard

Your home base shows:
- **Quick Stats** - Total items, locations, expiring items count
- **Expiring Soon** - Items expiring within 7 days (if any)
- **Recently Added** - Your 5 most recent items

### Inventory Page

Tap **Inventory** in the bottom nav to browse all items.

**View Modes:**
- **Gallery** - Photo grid (default)
- **List** - Detailed rows with location paths

**Filters:**
- **Category** - Filter by one or more categories
- **Location** - Filter by storage location
- **Sort** - By newest, oldest, name, or expiration date

Pull down on the page to refresh your inventory.

---

## Searching for Items

### Text Search

1. Tap the **Search** icon in the header
2. Type your search terms
3. Results appear in real-time as you type

**Searches across:**
- Item names
- Descriptions
- Tags
- Categories
- Locations
- Brands

### Voice Search

1. On the Search page, tap the **microphone** icon
2. Speak your query (e.g., "Where are my red shoes?")
3. Results appear automatically

Voice search requires microphone permission.

### Recent Searches

Your last 10 searches are saved for quick access. Tap any recent search to run it again.

---

## Managing Items

### Viewing Item Details

Tap any item to see:
- **Full-size photo** (tap to zoom)
- **Expiration banner** (if applicable)
- **Name, category, location, tags**
- **All details** in an expandable section
- **Metadata** (added date, last viewed)

### Editing Items

1. Open an item
2. Tap **Edit** in the bottom action bar
3. Make your changes
4. Tap **Save Changes**

### Deleting Items

1. Open an item
2. Tap **Delete** (red outline button)
3. Confirm the deletion

**Note:** Items are "soft deleted" and can be restored within 30 days.

### Quick Actions

Use the **⋮** menu to:
- **Share** - Share the item via Web Share API
- **Add to Favorites** - Mark items you use frequently
- **Keep Forever** - Exclude from unused item reminders

---

## Shopping Assistant

The AI Shopping Assistant helps you avoid duplicate purchases.

### How It Works

1. Tap **Shop** in the bottom navigation
2. Take a photo of something you're considering buying
3. The AI will:
   - Identify the item
   - Search your inventory for similar items
   - Show you what you already own that's similar
   - Provide advice on whether to buy

### Conversation Mode

After the initial analysis, you can:
- Ask follow-up questions
- Add more photos to the conversation
- Get personalized recommendations

**Usage Limits:** 20 photo analyses and 50 text questions per day (resets at midnight UTC).

---

## Settings & Preferences

### Account Section

- **Profile** - View and edit your display name
- **Change Password** - Reset your password
- **Log Out** - Sign out of your account

### Reminders & Notifications

- **Enable Reminders** - Master toggle for all reminders
- **Unused Item Reminder** - Get alerts for items not used in 30/60/90/180/365 days
- **Expiration Reminder** - Get alerts X days before items expire (3/7/14/30 days)
- **Push Notifications** - Enable browser push notifications

**Note:** Push notifications require browser permission.

### Display

- **Default View** - Choose Gallery or List view for Inventory

---

## Tips & Best Practices

### Adding Items Quickly

- **Batch photos:** Take multiple photos of the same area for faster entry
- **Use categories:** They make filtering much easier
- **Set locations:** The hierarchy (Home > Room > Shelf > Box) helps you find things
- **Add expiration dates:** Get timely reminders for food and cosmetics

### Organizing Locations

Create a logical hierarchy:
```
Home
├── Kitchen
│   ├── Pantry
│   │   └── Shelf A
│   └── Refrigerator
├── Bedroom
│   └── Closet
│       └── Winter Clothes Box
└── Garage
    └── Storage Rack
```

### Search Tips

- **Use tags** for things you search for often (e.g., #gift, #lent-to-john)
- **Be specific** in descriptions for better semantic search
- **Mark favorites** for quick access to frequently-used items

### Offline Usage

Ownly works offline! Your cached inventory remains viewable when you have no internet connection. An offline banner appears at the top when you're disconnected.

**Note:** AI features (photo analysis, shopping assistant) require an internet connection.

### App Updates

Ownly automatically checks for updates. When a new version is available:
1. A banner appears at the bottom of the screen
2. Tap **Update** to reload with the latest version
3. Or tap **Dismiss** to update later

The app will prompt you again on your next visit if you dismiss.

---

## FAQ

**Q: Is my data private?**
A: Yes. Your inventory is private and only accessible to you. We use Supabase for secure authentication and Row-Level Security to ensure your data is protected.

**Q: What happens to deleted items?**
A: Deleted items are kept for 30 days before permanent deletion. This allows you to recover accidentally deleted items.

**Q: How does AI photo recognition work?**
A: When you add a photo, we use OpenAI's GPT-4o Vision model to identify items, suggest categories, and extract relevant tags. The AI also detects visible brand names and provides confidence scores.

**Q: How does the Shopping Assistant find similar items?**
A: We use OpenAI's embedding models to create vector representations of your items. When you photograph something you're considering buying, we compare it against your inventory to find similar items you already own.

**Q: Why can't I use AI features offline?**
A: AI features require sending images and text to OpenAI's servers for processing. These features need an active internet connection. However, your cached inventory data is always available offline.

**Q: Does this work on desktop?**
A: Yes! Ownly is a Progressive Web App that works on any device with a modern web browser—phones, tablets, and desktop computers.

**Q: How do I install the app on my phone?**
A:
- **Android/Chrome:** Look for the "Install" or "Add to Home Screen" banner that appears after browsing
- **iOS Safari:** Tap the Share icon (box with arrow), then "Add to Home Screen"

**Q: What image formats are supported?**
A: JPEG, PNG, WebP, and HEIC (iOS photos). Images are automatically compressed if they exceed 2MB.

---

## Need Help?

For technical support or feature requests, please visit the project repository on GitHub.
