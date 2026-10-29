# SafeMeds MajiApp API

An Express API for water-purification inventory, product reviews, customer orders, and anonymized health-signal demo alerts backed by Supabase.

## Requirements

- Node.js 20 or later
- npm
- A Supabase project with the tables used by the endpoints

## Setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create a `.env` file in the project root. Keep this file private; it is excluded from Git:

   ```env
   PORT=3000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-api-key
   MAJIAPP_API_KEY=your-private-api-key
   ```

   You can use `API_KEYS` instead of `MAJIAPP_API_KEY` to configure multiple comma-separated request keys. If both are set, `API_KEYS` takes precedence. Optional:

   ```env
   HEALTH_SIGNALS_MODE=demo
   ```

   The health-signal mode defaults to `demo`.

3. Start the server:

   ```powershell
   npm start
   ```

   The API listens on port 3000 by default. Keep this terminal open while testing.

All endpoints require the `X-API-Key` request header. Use the value configured as `MAJIAPP_API_KEY` or one of the values in `API_KEYS`. Requests are limited to 100 per API key per 60 seconds; excess requests receive `429 Too Many Requests` and a `Retry-After` header. Do not commit `.env` or share credentials.

## Endpoints

Use this header in the examples below. Replace the prompt value with the API key from your local `.env`:

```powershell
$apiKey = Read-Host "API key"
$headers = @{"X-API-Key"=$apiKey}
```

### `GET /tasks`

A simple protected connectivity check. It does not read or write database data.

- **Inputs:** No query parameters or request body.
- **Success:** `200 OK` with `{"message":"Success! You accessed a protected endpoint."}`.
- **Useful for:** Confirming the server is reachable and the API key is accepted.

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/tasks" -Headers $headers
```

### `GET /inventory`

Returns water-purification items from the Supabase `inventory` table. Each item is reshaped to expose its ID, name, stock quantity, and whether any stock is available.

- **Inputs:** Optional `product` filters item names by a case-insensitive substring. Optional `available=true` returns stocked items; `available=false` returns items with no stock.
- **Success:** `200 OK` with an array of `{ productId, productName, availableQuantity, isAvailable }`. No matches returns an empty array.
- **Data access:** Reads inventory rows in the `Water Purification` category; it does not change stock.

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/inventory?product=Aquatabs&available=true" -Headers $headers
```

### `GET /reviews`

Ranks water-purification products by their average customer rating. It joins review product IDs to water-purification items in `inventory`, calculates each average to one decimal place, counts reviews, and returns at most the top three products.

- **Inputs:** No query parameters or request body.
- **Success:** `200 OK` with an array of `{ productId, productName, averageRating, reviewCount, topComment }`. Products without matching reviews are omitted; no matches returns an empty array.
- **Data access:** Reads `product_reviews` and `inventory`; it does not modify either table. `topComment` is a sample review comment, not a separately ranked comment.

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/reviews" -Headers $headers
```

### `POST /orders`

Creates a new order in the Supabase `orders` table with status `Pending`.

- **Inputs:** JSON body with a numeric `productId`, positive numeric `quantity`, and optional `customerName`. If omitted, the customer name is stored as `Anonymous`. Send `Content-Type: application/json`.
- **Success:** `201 Created` with the new order ID, product, quantity, customer name, status, and creation time.
- **Important:** This endpoint writes a real order record. Use test data when demonstrating it.

```powershell
$body = @{
  productId = 7
  quantity = 5
  customerName = "Nairobi Relief Clinic"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3000/orders" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

### `GET /v1/health-signals/area-alerts`

Returns aggregate, anonymized prescription-spike alerts for one region. It does not return prescription event IDs or individual records.

- **Inputs:** Required `region` must exactly match a value in the data. Required `since` must be a valid `YYYY-MM-DD` date and cannot be in the future.
- **Success:** `200 OK` with an array of alerts. The array can be empty when no records meet the rule.
- **Data access:** Reads `prescription_events` columns `region`, `illness_category`, and `dispensed_at`. It currently evaluates Cholera and Typhoid.
- **Demo detection rule:** A day needs at least five prescriptions and, if the preceding seven-day baseline is non-zero, at least three times its average daily count. With a zero baseline, five prescriptions trigger an alert. Results are limited to the last seven calendar days, further restricted by `since`.
- **Alert fields:** Region, illness category, alert date and count, baseline dates/count/daily average, spike ratio (null when baseline is zero), detection thresholds, active status, and `signalMode`.

```powershell
$region = [uri]::EscapeDataString("your-exact-region-value")
$since = "2026-10-29"
Invoke-RestMethod `
  -Uri "http://localhost:3000/v1/health-signals/area-alerts?region=$region&since=$since" `
  -Headers $headers
```

The mode is `demo` by default (`HEALTH_SIGNALS_MODE=demo`). **These are demonstration signals, not validated outbreak detection or medical/dispatch advice. Do not use them to make operational decisions without validating the data and detection criteria with qualified stakeholders.**

## API testing guide

See [api_testing_documentation.md](./api_testing_documentation.md) for request examples and response details for all endpoints.
