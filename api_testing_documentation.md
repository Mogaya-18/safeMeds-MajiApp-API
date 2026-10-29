# SafeMeds MajiApp API - Testing Instructions

This guide provides step-by-step instructions and commands to test the protected API endpoints for local development and demonstration.

---

## Prerequisites

1. Ensure your environment variables in `.env` are configured with your Supabase credentials:
   ```env
   PORT=3000
   SUPABASE_URL=https://your-supabase-project.supabase.co
   SUPABASE_KEY=your-supabase-api-key
   MAJIAPP_API_KEY=your-private-api-key
   ```
   Alternatively, configure one or more comma-separated request keys with `API_KEYS` (when both key settings are present, `API_KEYS` takes precedence). All endpoints require a matching `X-API-Key` header.
2. Start the application server from the root directory of the project:
   ```bash
   npm start
   # or
   node server.js
   ```

---

## 1. GET /inventory

Retrieves all water purification medications from the database with availability indicators. Accepts optional query parameters (`product` and `available`).

### Testing in an API client

Because the API requires an `X-API-Key` header, use PowerShell or an API client that supports request headers (a browser address bar cannot add this header):

- **All Items:** `http://localhost:3000/inventory`
- **Filter by Product Name:** `http://localhost:3000/inventory?product=Aquatabs`
- **Filter by Availability:** `http://localhost:3000/inventory?available=true`

### Terminal Commands

#### Windows CMD / Terminal (cURL)

```cmd
curl.exe -i "http://localhost:3000/inventory" -H "X-API-Key: <YOUR_API_KEY>"
```

#### PowerShell

```powershell
$apiKey = Read-Host "API key"
Invoke-RestMethod -Uri "http://localhost:3000/inventory" -Method GET -Headers @{"X-API-Key"=$apiKey}
```

---

## 2. GET /reviews

Calculates average ratings, aggregates review counts, and returns the **Top 3** highest-rated Water Purification medications along with a sample customer review comment.

### Testing in an API client

Use PowerShell or an API client that can set the required `X-API-Key` header.

### Terminal Commands

#### Windows CMD / Terminal (cURL)

```cmd
curl.exe -i "http://localhost:3000/reviews" -H "X-API-Key: <YOUR_API_KEY>"
```

#### PowerShell

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/reviews" -Method GET -Headers @{"X-API-Key"=$apiKey}
```

---

## 3. POST /orders

Submits a new customer order for a product. Validates parameters at the API level and inserts the order record directly into the Supabase `orders` table.

### Required JSON Payload Structure

```json
{
  "productId": 7,
  "quantity": 5,
  "customerName": "Nairobi Relief Clinic"
}
```

### Terminal Commands

#### Windows CMD (`cmd.exe`)

```cmd
curl.exe -i -X POST http://localhost:3000/orders -H "X-API-Key: <YOUR_API_KEY>" -H "Content-Type: application/json" -d "{\"productId\":7,\"quantity\":5,\"customerName\":\"Nairobi Relief Clinic\"}"
```

#### PowerShell

```powershell
$apiKey = Read-Host "API key"
Invoke-RestMethod -Uri "http://localhost:3000/orders" -Method POST -Headers @{"X-API-Key"=$apiKey} -ContentType "application/json" -Body '{"productId": 7, "quantity": 5, "customerName": "Nairobi Relief Clinic"}'
```

#### Linux / macOS Terminal / Git Bash

```bash
curl -X POST http://localhost:3000/orders \
  -H "X-API-Key: <YOUR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"productId": 7, "quantity": 5, "customerName": "Nairobi Relief Clinic"}'
```

---

## 4. GET /v1/health-signals/area-alerts

Returns active, anonymized waterborne-illness alerts for a region, based on prescription spikes, so clean-water dispatch can be prioritized.

### Query Parameters

| Parameter | Required | Description |
| :-------- | :------- | :---------- |
| `region`  | Yes      | Exact region value stored in `prescription_events.region`. URL-encode the value if needed. |
| `since`   | Yes      | Earliest alert date in `YYYY-MM-DD` format, such as `2026-10-29`. |

The endpoint reads `prescription_events` (`region`, `illness_category`, `dispensed_at`) and currently evaluates Cholera and Typhoid. An alert is raised when a day has at least 5 prescriptions and at least 3 times the average daily count across the previous 7 calendar days. With no prior prescriptions in that baseline, 5 or more on a day triggers an alert. Only alerts within the last 7 days are returned, further limited by `since`. The response contains aggregate counts only; source event IDs are not returned.

Signals are labeled `demo` by default (`HEALTH_SIGNALS_MODE=demo`). Treat them as demonstration output, not validated outbreak detection or dispatch advice. Only change the mode after the underlying data and detection criteria have been validated for operational use.

### Authentication

This application requires an `X-API-Key` header for all endpoints. Set `API_KEYS` in `.env` to a comma-separated list of valid keys and use one of those keys in the request.

### Terminal Commands

#### Windows CMD (`cmd.exe`)

```cmd
curl.exe -i -G "http://localhost:3000/v1/health-signals/area-alerts" -H "X-API-Key: <YOUR_API_KEY>" --data-urlencode "region=nairobi-demo-kibera" --data-urlencode "since=2026-10-29"
```

#### PowerShell

```powershell
$apiKey = Read-Host "API key"
$region = [uri]::EscapeDataString("nairobi-demo-kibera")
$since = [uri]::EscapeDataString("2026-10-29")
Invoke-RestMethod -Uri "http://localhost:3000/v1/health-signals/area-alerts?region=$region&since=$since" -Method GET -Headers @{"X-API-Key"=$apiKey}
```

#### Linux / macOS Terminal / Git Bash

```bash
curl -i -G "http://localhost:3000/v1/health-signals/area-alerts" \
  -H "X-API-Key: <YOUR_API_KEY>" \
  --data-urlencode "region=nairobi-demo-kibera" \
  --data-urlencode "since=2026-10-29"
```

### Sample Success Response

```json
[
  {
    "region": "nairobi-demo-kibera",
    "illnessCategory": "Cholera",
    "alertDate": "2026-10-29",
    "prescriptionCount": 5,
    "baseline": {
      "startDate": "2026-10-22",
      "endDate": "2026-10-28",
      "prescriptionCount": 7,
      "dailyAverage": 1
    },
    "spikeRatio": 5,
    "detectionRule": {
      "minimumPrescriptions": 5,
      "spikeMultiplier": 3
    },
    "status": "active",
    "signalMode": "demo"
  }
]
```

The route requires the `prescription_events` table and the columns listed above to exist in Supabase.

---

## 5. Expected Responses Summary

| Endpoint                         | Method | Expected HTTP Status | Sample Success Output Format                                                                                           |
| :------------------------------- | :----- | :------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| `/tasks`                         | `GET`  | `200 OK`             | `{"message":"Success! You accessed a protected endpoint."}`                                                           |
| `/inventory`                     | `GET`  | `200 OK`             | `[{"productId":7,"productName":"Aquatabs","availableQuantity":100,"isAvailable":true}]`                                |
| `/reviews`                       | `GET`  | `200 OK`             | `[{"productId":19,"productName":"Aquamira","averageRating":4.8,"reviewCount":6,"topComment":"Clean water instantly"}]` |
| `/orders`                        | `POST` | `201 Created`        | `{"message":"Order placed successfully","orderId":1,"productId":7,"quantity":5,"status":"Pending"}`                    |
| `/v1/health-signals/area-alerts` | `GET`  | `200 OK`             | `[{"region":"nairobi-demo-kibera","illnessCategory":"Cholera","alertDate":"2026-10-29","prescriptionCount":5,"baseline":{"startDate":"2026-10-22","endDate":"2026-10-28","prescriptionCount":7,"dailyAverage":1},"spikeRatio":5,"detectionRule":{"minimumPrescriptions":5,"spikeMultiplier":3},"status":"active","signalMode":"demo"}]` |

# COMMAND FOR THE GET API

curl -i -H "X-API-Key: <YOUR_API_KEY>" http://localhost:3000/inventory

# COMMAND FOR THE POST API

curl -i -X POST http://localhost:3000/orders -H "X-API-Key: <YOUR_API_KEY>" -H "Content-Type: application/json" -d "{\"productId\": <YOUR_ID>, \"quantity\": <YOUR_QUANTITY>, \"customerName\": \"<YOUR_CUSTOMER_NAME>\"}"
