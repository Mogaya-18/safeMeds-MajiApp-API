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

All endpoints require the `X-API-Key` request header. Use the value configured as `MAJIAPP_API_KEY` or one of the values in `API_KEYS`. Do not commit `.env` or share credentials.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/inventory` | Water-purification inventory. Optional `product` and `available` filters. |
| `GET` | `/reviews` | Top three water-purification products by average rating. |
| `POST` | `/orders` | Creates a customer order. |
| `GET` | `/v1/health-signals/area-alerts?region={region}&since={YYYY-MM-DD}` | Aggregate waterborne-illness prescription-spike demo alerts. |

### Example: area alerts (PowerShell)

Run this in a second PowerShell window while the server is running:

```powershell
$apiKey = Read-Host "API key"
$region = [uri]::EscapeDataString("your-exact-region-value")
$since = "2026-10-29"
Invoke-RestMethod `
  -Uri "http://localhost:3000/v1/health-signals/area-alerts?region=$region&since=$since" `
  -Headers @{"X-API-Key"=$apiKey}
```

The route reads the Supabase `prescription_events` table's `region`, `illness_category`, and `dispensed_at` columns. It currently evaluates Cholera and Typhoid. The demo rule requires at least five prescriptions in a day and, when there is a non-zero baseline, at least three times the average daily count across the previous seven days. Results are limited to the last seven calendar days and to dates on or after `since`.

Alert responses include aggregate baseline counts, the spike ratio, and the detection rule. Individual event IDs are not returned. **These are demonstration signals, not validated outbreak detection or medical/dispatch advice. Do not use them to make operational decisions without validating the data and detection criteria with qualified stakeholders.**

## API testing guide

See [api_testing_documentation.md](./api_testing_documentation.md) for request examples and response details for all endpoints.
