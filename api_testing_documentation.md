# SafeMeds MajiApp API - Testing Instructions

This guide provides step-by-step instructions and commands to test all active API endpoints (`GET /inventory`, `GET /reviews`, `POST /orders`) for local development and demonstration.

---

## Prerequisites

1. Ensure your environment variables in `.env` are configured with your Supabase credentials:
   ```env
   PORT=3000
   SUPABASE_URL=https://your-supabase-project.supabase.co
   SUPABASE_KEY=your-supabase-anon-key
   ```
2. Start the application server from the root directory of the project:
   ```bash
   npm start
   # or
   node server.js
   ```

---

## 1. GET /inventory

Retrieves all water purification medications from the database with availability indicators. Accepts optional query parameters (`product` and `available`).

### Browser Testing
Open the following URLs directly in your browser:
* **All Items:** `http://localhost:3000/inventory`
* **Filter by Product Name:** `http://localhost:3000/inventory?product=Aquatabs`
* **Filter by Availability:** `http://localhost:3000/inventory?available=true`

### Terminal Commands

#### Windows CMD / Terminal (cURL)
```cmd
curl -X GET "http://localhost:3000/inventory"
```

#### PowerShell
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/inventory" -Method GET
```

---

## 2. GET /reviews

Calculates average ratings, aggregates review counts, and returns the **Top 3** highest-rated Water Purification medications along with a sample customer review comment.

### Browser Testing
Open in browser:
* `http://localhost:3000/reviews`

### Terminal Commands

#### Windows CMD / Terminal (cURL)
```cmd
curl -X GET "http://localhost:3000/reviews"
```

#### PowerShell
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/reviews" -Method GET
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
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" -d "{\"productId\":7,\"quantity\":5,\"customerName\":\"Nairobi Relief Clinic\"}"
```

#### PowerShell
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/orders" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"productId": 7, "quantity": 5, "customerName": "Nairobi Relief Clinic"}'
```

#### Linux / macOS Terminal / Git Bash
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"productId": 7, "quantity": 5, "customerName": "Nairobi Relief Clinic"}'
```

---

## 4. Expected Responses Summary

| Endpoint | Method | Expected HTTP Status | Sample Success Output Format |
| :--- | :--- | :--- | :--- |
| `/inventory` | `GET` | `200 OK` | `[{"productId":7,"productName":"Aquatabs","availableQuantity":100,"isAvailable":true}]` |
| `/reviews` | `GET` | `200 OK` | `[{"productId":19,"productName":"Aquamira","averageRating":4.8,"reviewCount":6,"topComment":"Clean water instantly"}]` |
| `/orders` | `POST` | `201 Created` | `{"message":"Order placed successfully","orderId":1,"productId":7,"quantity":5,"status":"Pending"}` |