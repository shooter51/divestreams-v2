# DiveStreams Users Guide

Welcome to DiveStreams, the comprehensive dive shop management platform. This guide will walk you through every feature of the application to help you manage your dive business efficiently.

**Staging URL**: https://demo.staging.divestreams.com

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Customer Management](#3-customer-management)
4. [Booking Management](#4-booking-management)
5. [Tour & Trip Management](#5-tour--trip-management)
6. [Dive Site Management](#6-dive-site-management)
7. [Equipment & Boats](#7-equipment--boats)
8. [Products & Discounts](#8-products--discounts)
9. [Training Courses](#9-training-courses)
10. [Gallery](#10-gallery)
11. [Point of Sale (POS)](#11-point-of-sale-pos)
12. [Reports & Analytics](#12-reports--analytics)
13. [Settings](#13-settings)

---

## 1. Getting Started

### Accessing Your Account

1. Navigate to your shop's subdomain (e.g., `yourshop.divestreams.com`)
2. Log in with your email and password
3. You'll be directed to your Dashboard

![Screenshot: Login Page](screenshots/login-page.png)

### Navigation Overview

The main navigation is located in the left sidebar and includes:

- **Dashboard** - Your business overview and quick actions
- **Bookings** - Manage customer reservations
- **Calendar** - Visual schedule of all trips
- **Customers** - Customer database and profiles
- **Tours** - Tour packages you offer
- **Trips** - Scheduled trip instances
- **Dive Sites** - Location database
- **Boats** - Fleet management
- **Equipment** - Rental inventory tracking
- **Products** - Retail items for sale
- **Discounts** - Promotional codes
- **Training** - Certification courses
- **Gallery** - Photo albums
- **POS** - Point of Sale terminal (Premium)
- **Reports** - Business analytics (Premium features)
- **Settings** - Account configuration

![Screenshot: Main Navigation](screenshots/main-navigation.png)

### Quick Tips for New Users

- Start by setting up your **Shop Profile** in Settings
- Add your **Boats** and **Dive Sites** before creating tours
- Import or add your **Customers** to build your database
- Create **Tours** as templates, then schedule **Trips** from them
- Use the **Dashboard** to monitor daily operations

---

## 2. Dashboard Overview

The Dashboard provides a real-time snapshot of your dive shop operations.

![Screenshot: Dashboard Overview](screenshots/dashboard-overview.png)

### Key Performance Indicators (KPIs)

At the top of the Dashboard, you'll find four key metrics:

| Metric | Description |
|--------|-------------|
| **Today's Bookings** | Number of bookings scheduled for today |
| **Upcoming Trips** | Trips scheduled in the next 7 days |
| **This Month's Revenue** | Total revenue for the current month |
| **Active Customers** | Customers with bookings in the last 90 days |

![Screenshot: Dashboard KPIs](screenshots/dashboard-kpis.png)

### Recent Bookings

The Recent Bookings section displays your latest reservations with:
- Customer name
- Trip/Tour name
- Date and time
- Booking status (Confirmed, Pending, Cancelled)
- Quick action links

### Quick Actions

Access frequently used functions directly from the Dashboard:
- **New Booking** - Create a new reservation
- **Add Customer** - Register a new customer
- **Schedule Trip** - Plan a new trip
- **View Calendar** - Jump to calendar view

### Tips

- Check your Dashboard first thing each morning to see the day's schedule
- Use the KPI trends to identify busy periods and plan staffing
- Click on any booking to view full details or make changes

---

## 3. Customer Management

Manage your customer database, track certifications, and view booking history.

![Screenshot: Customer List](screenshots/customer-list.png)

### Viewing Customers

The Customers page displays a searchable, paginated list of all customers:

- **Search**: Filter by name, email, or phone number
- **Pagination**: Navigate through large customer lists
- **Quick View**: See certification status at a glance

### Customer Information Displayed

| Field | Description |
|-------|-------------|
| Name | Customer's full name |
| Email | Contact email address |
| Phone | Phone number |
| Certification | Current dive certification level |
| Last Booking | Date of most recent booking |
| Total Bookings | Lifetime booking count |

### Adding a New Customer

1. Click the **"Add Customer"** button
2. Fill in the required fields:
   - First Name
   - Last Name
   - Email Address
   - Phone Number (optional)
3. Add certification details:
   - Certification Agency (PADI, SSI, NAUI, etc.)
   - Certification Level
   - Certification Number
   - Certification Date
4. Click **"Save Customer"**

![Screenshot: Add Customer Form](screenshots/add-customer-form.png)

### Editing Customer Details

1. Click on a customer's name to open their profile
2. Click **"Edit"** to modify their information
3. Update any fields as needed
4. Click **"Save Changes"**

### Customer Profile View

Each customer profile includes:
- Contact information
- Certification details with expiration tracking
- Complete booking history
- Equipment rental history
- Notes and preferences

![Screenshot: Customer Profile](screenshots/customer-profile.png)

### Tips

- Keep certification information up to date to ensure customers can participate in appropriate dives
- Use the notes field to record preferences like equipment sizes or dietary restrictions
- Regularly export customer data for backup purposes

---

## 4. Booking Management

Create, manage, and track all customer reservations.

![Screenshot: Bookings List](screenshots/bookings-list.png)

### Booking List Overview

The Bookings page shows all reservations with:
- Customer name and contact info
- Trip/Tour details
- Date and time
- Number of participants
- Status badge (Confirmed, Pending, Cancelled, Completed)
- Payment status

### Filtering Bookings

Use the filter options to narrow down your view:
- **Date Range**: Select start and end dates
- **Status**: Filter by booking status
- **Trip/Tour**: Filter by specific trip or tour
- **Search**: Find bookings by customer name or booking ID

### Creating a New Booking

1. Click **"New Booking"** button
2. **Select Customer**: Search and select an existing customer or create new
3. **Select Trip**: Choose from available scheduled trips
4. **Add Participants**: Specify number of divers
5. **Equipment Rental** (optional): Add rental items
6. **Apply Discount** (optional): Enter discount code
7. **Review Total**: Verify pricing breakdown
8. **Confirm Booking**: Click "Create Booking"

![Screenshot: New Booking Form](screenshots/new-booking-form.png)

### Booking Details

Click any booking to view full details:
- Customer information
- Trip details with dive site information
- Participant list
- Equipment rentals
- Payment history
- Activity log

### Managing Booking Status

Update booking status as needed:
- **Pending**: Awaiting confirmation or payment
- **Confirmed**: Booking is confirmed
- **Checked-In**: Customer has arrived
- **Completed**: Trip finished successfully
- **Cancelled**: Booking was cancelled
- **No-Show**: Customer didn't attend

### Email Notifications

The system automatically sends emails for:
- Booking confirmation
- Booking reminders (24 hours before)
- Booking cancellation
- Payment receipts

### Tips

- Use the calendar view for a visual overview of booking density
- Set up automatic reminders to reduce no-shows
- Track equipment rentals to ensure availability
- Use discount codes for repeat customers or group bookings

---

## 5. Tour & Trip Management

Tours are your product templates; Trips are scheduled instances of those tours.

### Tours

Tours define your diving experiences and packages.

![Screenshot: Tours List](screenshots/tours-list.png)

#### Creating a Tour

1. Navigate to **Tours** in the sidebar
2. Click **"Add Tour"**
3. Fill in tour details:
   - **Name**: e.g., "Morning Reef Dive"
   - **Description**: Detailed description for customers
   - **Duration**: Length in hours
   - **Price**: Base price per person
   - **Max Capacity**: Maximum participants
   - **Difficulty Level**: Beginner, Intermediate, Advanced
   - **Requirements**: Minimum certification, experience level
4. Add included items (equipment, lunch, photos, etc.)
5. Upload tour images
6. Click **"Save Tour"**

![Screenshot: Create Tour Form](screenshots/create-tour-form.png)

#### Tour Details

Each tour displays:
- Tour name and description
- Price and duration
- Capacity limits
- Associated dive sites
- Upcoming scheduled trips
- Booking statistics

### Trips

Trips are specific scheduled instances of tours.

![Screenshot: Trips List](screenshots/trips-list.png)

#### Scheduling a Trip

1. Navigate to **Trips** in the sidebar
2. Click **"Schedule Trip"**
3. Select the **Tour** to schedule
4. Set the **Date and Time**
5. Choose the **Boat** to use
6. Select **Dive Site(s)** to visit
7. Assign **Staff/Guides** (optional)
8. Set **Custom Capacity** if different from tour default
9. Add **Notes** for staff
10. Click **"Create Trip"**

![Screenshot: Schedule Trip Form](screenshots/schedule-trip-form.png)

#### Trip Status

Trips can have the following statuses:
- **Scheduled**: Future trip, open for bookings
- **Full**: Maximum capacity reached
- **In Progress**: Currently happening
- **Completed**: Trip finished
- **Cancelled**: Trip was cancelled

#### Managing Trip Capacity

The trip list shows:
- **Available Spots**: Remaining capacity
- **Booked**: Number of confirmed bookings
- **Capacity Bar**: Visual indicator of fill level

![Screenshot: Trip Capacity](screenshots/trip-capacity.png)

### Calendar Integration

View all trips on the Calendar page:
- Color-coded by status
- Click to view trip details
- Drag to reschedule (if no bookings)

### Tips

- Create tour templates for your regular offerings
- Schedule trips well in advance for better booking rates
- Use the calendar to avoid double-booking boats or staff
- Monitor capacity to know when to add additional trips

---

## 6. Dive Site Management

Maintain your database of dive locations.

![Screenshot: Dive Sites List](screenshots/dive-sites-list.png)

### Dive Site Information

Each dive site record includes:
- **Name**: Site name
- **Location**: GPS coordinates
- **Description**: Detailed site description
- **Depth Range**: Min/Max depth in meters or feet
- **Difficulty**: Skill level required
- **Highlights**: Notable features (coral, wrecks, marine life)
- **Conditions**: Typical current, visibility
- **Access**: Shore dive, boat dive, distance from shop

### Adding a Dive Site

1. Navigate to **Dive Sites**
2. Click **"Add Dive Site"**
3. Enter site details:
   - Name and description
   - GPS coordinates (latitude/longitude)
   - Depth information
   - Difficulty rating
   - Best conditions/seasons
4. Upload site photos
5. Add safety notes
6. Click **"Save Site"**

![Screenshot: Add Dive Site Form](screenshots/add-dive-site-form.png)

### Site Map View

Toggle between list and map view to see:
- All dive sites plotted on a map
- Click markers for quick info
- Plan routes between sites

### Tips

- Keep GPS coordinates accurate for navigation
- Update conditions based on seasonal changes
- Include safety information for each site
- Add photos to help customers choose sites

---

## 7. Equipment & Boats

Manage your rental equipment inventory and boat fleet.

### Equipment Management

Track all rental equipment and inventory.

![Screenshot: Equipment List](screenshots/equipment-list.png)

#### Equipment Categories

- Masks and Snorkels
- Fins
- Wetsuits and Exposure Protection
- BCDs (Buoyancy Control Devices)
- Regulators
- Tanks/Cylinders
- Dive Computers
- Cameras and Accessories
- Specialty Equipment

#### Adding Equipment

1. Navigate to **Equipment**
2. Click **"Add Equipment"**
3. Enter details:
   - **Name**: e.g., "Cressi BCD - Large"
   - **Category**: Select from categories
   - **Serial Number**: For tracking
   - **Size**: If applicable (S, M, L, XL)
   - **Condition**: New, Good, Fair, Needs Service
   - **Rental Price**: Daily rate
   - **Purchase Date**: For depreciation tracking
   - **Last Service**: Maintenance date
4. Click **"Save Equipment"**

![Screenshot: Add Equipment Form](screenshots/add-equipment-form.png)

#### Equipment Status Tracking

Monitor equipment status:
- **Available**: Ready for rental
- **Rented**: Currently with customer
- **In Service**: Under maintenance
- **Retired**: No longer in use

#### Rental Management

When creating a booking, you can:
- Add equipment rentals
- Check availability by date
- Assign specific items by serial number
- Track rental history

### Boat Management

Manage your dive boat fleet.

![Screenshot: Boats List](screenshots/boats-list.png)

#### Adding a Boat

1. Navigate to **Boats**
2. Click **"Add Boat"**
3. Enter boat details:
   - **Name**: Boat name
   - **Type**: e.g., Speed boat, Catamaran
   - **Capacity**: Maximum passengers
   - **Features**: Covered area, toilet, fresh water, etc.
   - **Registration**: Official registration number
4. Upload boat photos
5. Click **"Save Boat"**

![Screenshot: Add Boat Form](screenshots/add-boat-form.png)

#### Boat Scheduling

Boats are assigned when scheduling trips:
- Check boat availability by date
- Avoid double-booking
- Plan maintenance windows

### Tips

- Regular equipment maintenance extends lifespan and ensures safety
- Track service intervals for regulators and BCDs
- Keep boat maintenance logs up to date
- Use serial numbers to track specific items through rentals

---

## 8. Products & Discounts

Manage retail products and promotional codes.

### Products

Sell retail items through the POS or track inventory.

![Screenshot: Products List](screenshots/products-list.png)

#### Product Information

Each product includes:
- **Name**: Product name
- **SKU**: Stock keeping unit
- **Category**: Gear, Accessories, Apparel, etc.
- **Price**: Retail price
- **Cost**: Your cost (for profit tracking)
- **Stock Level**: Current inventory count
- **Reorder Point**: When to restock

#### Adding a Product

1. Navigate to **Products**
2. Click **"Add Product"**
3. Enter product details:
   - Name and description
   - SKU code
   - Category
   - Pricing (cost and retail)
   - Initial stock quantity
   - Reorder threshold
4. Upload product image
5. Click **"Save Product"**

![Screenshot: Add Product Form](screenshots/add-product-form.png)

#### Inventory Management

- Track stock levels in real-time
- Get alerts when inventory is low
- Record stock adjustments
- View inventory value reports

### Discounts

Create promotional codes for marketing campaigns.

![Screenshot: Discounts List](screenshots/discounts-list.png)

#### Discount Types

- **Percentage**: e.g., 10% off
- **Fixed Amount**: e.g., $20 off
- **Free Item**: Include item at no charge

#### Creating a Discount Code

1. Navigate to **Discounts**
2. Click **"Add Discount"**
3. Configure the discount:
   - **Code**: e.g., "SUMMER2024"
   - **Type**: Percentage or Fixed
   - **Value**: Discount amount
   - **Minimum Purchase**: Required minimum
   - **Valid From/To**: Date range
   - **Usage Limit**: Max number of uses
   - **One Per Customer**: Limit to single use per customer
4. Select applicable products/tours
5. Click **"Save Discount"**

![Screenshot: Create Discount Form](screenshots/create-discount-form.png)

#### Discount Tracking

Monitor discount performance:
- Total uses
- Revenue impact
- Most popular codes
- Customer usage history

### Tips

- Use seasonal discount codes to drive bookings during slow periods
- Track product costs to ensure healthy profit margins
- Set reorder points to avoid stockouts
- Create exclusive codes for loyal customers

---

## 9. Training Courses

Manage dive certifications, courses, and student progress.

![Screenshot: Training Overview](screenshots/training-overview.png)

### Certification Agencies

DiveStreams supports major certification agencies:
- **PADI** - Professional Association of Diving Instructors
- **SSI** - Scuba Schools International
- **NAUI** - National Association of Underwater Instructors

Each agency has predefined certification levels that can be assigned to customers and courses.

### Course Management

#### Viewing Courses

The Training section displays:
- Available courses by agency
- Student enrollment counts
- Upcoming course dates
- Instructor assignments

#### Course Information

Each course includes:
- **Name**: e.g., "Open Water Diver"
- **Agency**: Certification agency
- **Level**: Certification level
- **Duration**: Course length (days/hours)
- **Price**: Course fee
- **Prerequisites**: Required prior certifications
- **Max Students**: Class size limit
- **Materials**: Required study materials

### Student Progress

Track student advancement through courses:
- **Enrolled**: Registered for course
- **In Progress**: Currently completing requirements
- **Certified**: Successfully completed
- **Dropped**: Did not complete

### Scheduling Courses

Link courses with trips for open water training dives:
1. Create the course session
2. Schedule associated training trips
3. Track confined water and open water requirements
4. Issue certification upon completion

### Tips

- Keep instructor certifications up to date
- Track student progress to ensure timely completion
- Schedule makeup sessions for missed dives
- Issue certifications promptly after completion

---

## 10. Gallery

Manage photo albums to showcase your dive experiences.

![Screenshot: Gallery Overview](screenshots/gallery-overview.png)

### Album Management

Create organized collections of dive photos.

#### Creating an Album

1. Navigate to **Gallery**
2. Click **"Create Album"**
3. Enter album details:
   - **Name**: Album title
   - **Description**: Album description
   - **Date**: Trip date
   - **Visibility**: Public or Private
   - **Trip Link**: Associate with specific trip (optional)
4. Click **"Create Album"**

![Screenshot: Create Album Form](screenshots/create-album-form.png)

#### Album Visibility

- **Public**: Visible on your public website
- **Private**: Only accessible to logged-in staff

### Uploading Photos

1. Open an album
2. Click **"Upload Photos"**
3. Select images from your device
4. Add captions (optional)
5. Click **"Upload"**

Supported formats: JPG, PNG, WEBP

### Sharing Albums

Share albums with customers:
- Generate shareable links
- Embed on your website
- Share via email or social media

### Tips

- Organize photos by trip date for easy searching
- Add captions with customer names (with permission)
- Use high-quality images to showcase your diving experiences
- Share albums on social media to attract new customers

---

## 11. Point of Sale (POS)

**Premium Feature** - Process walk-in sales and in-shop transactions.

![Screenshot: POS Terminal](screenshots/pos-terminal.png)

### POS Interface

The POS provides a streamlined checkout experience:

#### Product Grid

- Browse products by category
- Quick search functionality
- View product images and prices
- See stock availability

#### Cart Management

- Add items to cart with single click
- Adjust quantities
- Remove items
- Apply discount codes
- View running total

![Screenshot: POS Cart](screenshots/pos-cart.png)

### Processing a Sale

1. **Add Items**: Click products to add to cart
2. **Apply Discounts**: Enter discount code if applicable
3. **Select Customer**: Link to existing customer (optional)
4. **Choose Payment Method**:
   - Cash
   - Credit/Debit Card
   - Split Payment
5. **Complete Sale**: Click "Checkout"
6. **Print Receipt**: Generate receipt for customer

![Screenshot: POS Checkout](screenshots/pos-checkout.png)

### Payment Processing

DiveStreams integrates with Stripe for card payments:
- Secure card processing
- Contactless payments
- Split tender transactions
- Refund processing

### Daily Operations

- **Open Register**: Start shift with opening count
- **Close Register**: End-of-day reconciliation
- **X Report**: Mid-day sales summary
- **Z Report**: End-of-day close report

### Tips

- Train staff on efficient POS usage
- Keep popular items easily accessible in the grid
- Reconcile the register at end of each day
- Use customer linking to track purchase history

---

## 12. Reports & Analytics

Access business intelligence and performance metrics.

![Screenshot: Reports Dashboard](screenshots/reports-dashboard.png)

### Available Reports

#### Revenue Reports

Track financial performance:
- **Daily Revenue**: Sales by day
- **Monthly Revenue**: Monthly trends
- **Revenue by Category**: Tours, Equipment, Products
- **Payment Methods**: Cash vs Card breakdown

![Screenshot: Revenue Report](screenshots/revenue-report.png)

#### Booking Reports

Analyze booking patterns:
- **Booking Volume**: Bookings over time
- **Booking Sources**: How customers find you
- **Cancellation Rate**: Track cancellations
- **No-Show Rate**: Monitor attendance

#### Customer Reports

Understand your customer base:
- **New Customers**: Customer acquisition
- **Repeat Customers**: Loyalty metrics
- **Customer Lifetime Value**: Revenue per customer
- **Certification Distribution**: Customer skill levels

#### Trip Reports

Evaluate trip performance:
- **Trip Utilization**: Capacity usage
- **Popular Tours**: Best-selling tours
- **Site Popularity**: Most visited dive sites
- **Seasonal Trends**: Busy periods

### Premium Reports

Unlock advanced analytics with Premium:
- **Profit Margin Analysis**
- **Forecast Projections**
- **Custom Report Builder**
- **Scheduled Reports via Email**

### Date Range Selection

All reports support flexible date ranges:
- Preset ranges (Today, This Week, This Month, etc.)
- Custom date range picker
- Compare periods

### Exporting Reports

Export data in multiple formats:
- **PDF**: For printing and sharing
- **CSV**: For spreadsheet analysis
- **Excel**: For detailed data work

![Screenshot: Export Options](screenshots/export-options.png)

### Tips

- Review reports weekly to identify trends
- Compare periods to measure growth
- Use insights to optimize pricing and scheduling
- Share reports with stakeholders as needed

---

## 13. Settings

Configure your DiveStreams account and preferences.

![Screenshot: Settings Overview](screenshots/settings-overview.png)

### Shop Profile

Configure your business information:
- **Business Name**: Your shop name
- **Address**: Physical location
- **Phone & Email**: Contact information
- **Timezone**: Operating timezone
- **Currency**: Default currency
- **Business Hours**: Operating schedule

![Screenshot: Shop Profile](screenshots/shop-profile.png)

### Billing & Subscription

Manage your DiveStreams subscription:

#### Current Plan

View your active subscription:
- Plan name (Free, Pro, Enterprise)
- Features included
- Usage statistics
- Billing cycle

#### Upgrade/Downgrade

Change your plan:
1. Navigate to **Settings > Billing**
2. Click **"Change Plan"**
3. Select new plan
4. Confirm billing changes
5. Access new features immediately

![Screenshot: Subscription Plans](screenshots/subscription-plans.png)

#### Payment Methods

Manage payment options:
- Add credit/debit cards
- Set default payment method
- View billing history
- Download invoices

### Team Members

Manage staff access:

#### Adding Team Members

1. Click **"Invite Member"**
2. Enter email address
3. Select role:
   - **Admin**: Full access
   - **Manager**: Operational access
   - **Staff**: Limited access
4. Send invitation

#### Role Permissions

| Permission | Admin | Manager | Staff |
|------------|-------|---------|-------|
| View Dashboard | Yes | Yes | Yes |
| Create Bookings | Yes | Yes | Yes |
| Manage Customers | Yes | Yes | Limited |
| Edit Tours/Trips | Yes | Yes | No |
| Access Reports | Yes | Yes | No |
| Manage Team | Yes | No | No |
| Billing Settings | Yes | No | No |

![Screenshot: Team Management](screenshots/team-management.png)

### Integrations

Connect third-party services:

#### Available Integrations

- **Stripe**: Payment processing
- **Google Calendar**: Sync schedules
- **Email Service**: Automated notifications
- **Accounting Software**: Financial sync

#### Setting Up Stripe

1. Navigate to **Settings > Integrations**
2. Click **"Connect Stripe"**
3. Log in to your Stripe account
4. Authorize DiveStreams
5. Configure payment settings

![Screenshot: Integrations](screenshots/integrations.png)

### Notifications

Configure automated communications:

#### Email Notifications

- Booking confirmations
- Booking reminders
- Cancellation notices
- Payment receipts
- Staff alerts

#### Notification Timing

- Set reminder intervals (24hr, 48hr)
- Configure quiet hours
- Choose notification recipients

### Booking Widget

Embed booking on your website:

1. Navigate to **Settings > Booking Widget**
2. Customize appearance:
   - Colors and branding
   - Available tours
   - Date ranges
3. Copy embed code
4. Paste into your website

![Screenshot: Booking Widget](screenshots/booking-widget.png)

### Public Site

Configure your public-facing website:

- **Homepage Content**: Hero images, descriptions
- **Tour Listings**: Public tour display
- **Contact Form**: Customer inquiries
- **SEO Settings**: Meta tags and descriptions

### Data Management

#### Seed Demo Data

For new accounts, load sample data to explore features:
1. Navigate to **Settings**
2. Find "Get Started" section
3. Click **"Load Demo Data"**

Demo data includes sample customers, tours, bookings, and equipment.

#### Export Data

Download all your data:
1. Navigate to **Settings**
2. Find "Danger Zone"
3. Click **"Export Data"**
4. Receive JSON file with all records

#### Delete Account

Permanently delete your account:
1. Navigate to **Settings**
2. Find "Danger Zone"
3. Click **"Delete Account"**
4. Confirm deletion (requires typing "DELETE")

**Warning**: This action cannot be undone. All data will be permanently removed.

### Tips

- Keep your business profile up to date for accurate invoices
- Regularly review team access permissions
- Set up integrations early for seamless operations
- Test the booking widget on your website
- Export data regularly for backup

---

## Getting Help

### Support Resources

- **Email Support**: support@divestreams.com
- **Documentation**: docs.divestreams.com
- **Status Page**: status.divestreams.com

### Feedback

We welcome your feedback to improve DiveStreams:
- Use the in-app feedback button
- Email suggestions to feedback@divestreams.com

---

## Appendix: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | New Booking |
| `Ctrl/Cmd + K` | Quick Search |
| `Ctrl/Cmd + /` | Open Help |
| `Esc` | Close Modal |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | January 2025 | Initial release |

---

*This guide covers DiveStreams v2. Features may vary based on your subscription plan.*
