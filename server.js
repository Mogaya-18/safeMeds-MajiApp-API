import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WATER_CATEGORY = "Water Purification";
const WATERBORNE_ILLNESSES = new Set(["cholera", "typhoid"]);
const ALERT_LOOKBACK_DAYS = 7;
const ALERT_BASELINE_DAYS = 7;
const MIN_ALERT_PRESCRIPTIONS = 5;
const SPIKE_MULTIPLIER = 3;
const HEALTH_SIGNALS_MODE = process.env.HEALTH_SIGNALS_MODE || "demo";

const supabaseURL = process.env.SUPABASE_URL;
const supabaseKEY = process.env.SUPABASE_KEY;

if (!supabaseURL || !supabaseKEY) {
  console.error("❌ Error: SUPABASE_URL or SUPABASE_KEY missing in .env file!");
}

const supabase = createClient(supabaseURL, supabaseKEY);

const VALID_KEYS = (process.env.API_KEYS || "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

console.log(`Loaded ${VALID_KEYS.length} valid API keys.`);

function requireApiKey(req, res, next) {
  const key = req.get("X-API-Key");
  if (!key || !VALID_KEYS.includes(key)) {
    return res.status(401).json({ message: "Missing or invalid API key" });
  }
  req.apiKey = key;
  next();
}

app.use(requireApiKey);

// In-memory request counter per key
function rateLimit({ windowMs, max }) {
  const hits = new Map(); // key -> { count, resetAt }

  return (req, res, next) => {
    const id = req.apiKey || req.ip;
    const now = Date.now();
    let entry = hits.get(id);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(id, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        message: "Too many requests",
        retryAfter,
      });
    }

    next();
  };
}

// Register rate limiter globally: 100 requests per 60 seconds
app.use(rateLimit({ windowMs: 60000, max: 100 }));

app.get("/tasks", (req, res) => {
  res.json({ message: "Success! You accessed a protected endpoint." });
});

// -----------------------------------------------------------------------------
// 1. GET /inventory - Exposes Water Purification Inventory
// -----------------------------------------------------------------------------
app.get("/inventory", async (req, res) => {
  try {
    const { product, available } = req.query;

    let query = supabase
      .from("inventory")
      .select("*")
      .ilike("category", WATER_CATEGORY);

    if (product) {
      query = query.ilike("item_name", `%${product}%`);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("Supabase Error on /inventory:", error.message);
      return res.status(400).json({ message: error.message });
    }

    let responseData = (rows || []).map((item) => ({
      productId: item.id,
      productName: item.item_name,
      availableQuantity: item.current_stock,
      isAvailable: item.current_stock > 0,
    }));

    if (available !== undefined) {
      const isAvailableBool = available === "true";
      responseData = responseData.filter(
        (item) => item.isAvailable === isAvailableBool,
      );
    }

    return res.status(200).json(responseData);
  } catch (err) {
    console.error("GET /inventory catch error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------
// 2. GET /reviews - Computes Average Ratings & Returns Top 3 Products
// -----------------------------------------------------------------------------
app.get("/reviews", async (req, res) => {
  try {
    const { data: reviews, error: reviewError } = await supabase
      .from("product_reviews")
      .select("*");

    const { data: inventory, error: invError } = await supabase
      .from("inventory")
      .select("id, item_name, category");

    console.log("--- DEBUG LOGS ---");
    console.log("Fetched Reviews Count:", reviews ? reviews.length : 0);
    console.log("Fetched Inventory Count:", inventory ? inventory.length : 0);
    console.log("Raw Inventory Items:", inventory);
    console.log("------------------");

    if (reviewError || invError) {
      return res.status(400).json({
        reviewError: reviewError?.message,
        invError: invError?.message,
      });
    }

    // Map inventory IDs for lookup
    const waterProdMap = {};
    (inventory || []).forEach((item) => {
      // Check for exact category match (case-insensitive & trimmed)
      if (
        item.category &&
        item.category.trim().toLowerCase() === WATER_CATEGORY.toLowerCase()
      ) {
        waterProdMap[String(item.id)] = item.item_name;
      }
    });

    console.log("Matching Water Purification Product Map:", waterProdMap);

    const productStats = {};

    (reviews || []).forEach((item) => {
      if (!item || !item.product_id) return;

      const prodIdStr = String(item.product_id);

      if (waterProdMap[prodIdStr]) {
        if (!productStats[prodIdStr]) {
          productStats[prodIdStr] = {
            productId: Number(item.product_id),
            productName: waterProdMap[prodIdStr],
            totalRatingSum: 0,
            reviewCount: 0,
            sampleComment: item.review_text || "",
          };
        }

        productStats[prodIdStr].totalRatingSum += Number(item.rating || 0);
        productStats[prodIdStr].reviewCount += 1;
      }
    });

    const rankedProducts = Object.values(productStats)
      .map((prod) => ({
        productId: prod.productId,
        productName: prod.productName,
        averageRating: Number(
          (prod.totalRatingSum / prod.reviewCount).toFixed(1),
        ),
        reviewCount: prod.reviewCount,
        topComment: prod.sampleComment,
      }))
      .sort((a, b) => b.averageRating - a.averageRating);

    return res.status(200).json(rankedProducts.slice(0, 3));
  } catch (err) {
    console.error("GET /reviews catch error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------
// 3. GET /v1/health-signals/area-alerts - Returns Anonymized Prescription Spikes
// -----------------------------------------------------------------------------
app.get("/v1/health-signals/area-alerts", async (req, res) => {
  const { region, since } = req.query;

  if (typeof region !== "string" || !region.trim()) {
    return res.status(400).json({
      message: "Invalid query. 'region' must be a non-empty string.",
    });
  }

  if (
    typeof since !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(since) ||
    Number.isNaN(Date.parse(`${since}T00:00:00.000Z`)) ||
    new Date(`${since}T00:00:00.000Z`).toISOString().slice(0, 10) !== since
  ) {
    return res.status(400).json({
      message: "Invalid query. 'since' must be a valid ISO date (YYYY-MM-DD).",
    });
  }

  const now = new Date();
  const sinceDate = new Date(`${since}T00:00:00.000Z`);
  if (sinceDate > now) {
    return res.status(400).json({
      message: "'since' must not be a future date.",
    });
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const activeWindowStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - ALERT_LOOKBACK_DAYS + 1,
    ),
  );
  const detectionStart =
    sinceDate > activeWindowStart ? sinceDate : activeWindowStart;
  const historyStart = new Date(
    detectionStart.getTime() - ALERT_BASELINE_DAYS * dayMs,
  );
  const regionName = region.trim();
  const events = [];
  const pageSize = 1000;

  try {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("prescription_events")
        .select("id, region, illness_category, dispensed_at")
        .eq("region", regionName)
        .gte("dispensed_at", historyStart.toISOString())
        .lte("dispensed_at", now.toISOString())
        .order("dispensed_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error(
          "Supabase Error on /v1/health-signals/area-alerts:",
          error.message,
        );
        return res
          .status(500)
          .json({ message: "Unable to retrieve area alerts" });
      }

      events.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    const dailyCounts = new Map();
    const illnessNames = new Map();

    for (const event of events) {
      const illnessKey = String(event.illness_category || "")
        .trim()
        .toLowerCase();
      if (!WATERBORNE_ILLNESSES.has(illnessKey)) continue;

      const eventDate = new Date(event.dispensed_at);
      if (Number.isNaN(eventDate.getTime())) continue;

      const day = eventDate.toISOString().slice(0, 10);
      const key = `${illnessKey}:${day}`;
      dailyCounts.set(key, (dailyCounts.get(key) || 0) + 1);
      illnessNames.set(illnessKey, String(event.illness_category).trim());
    }

    const alerts = [];
    const startDay = detectionStart.toISOString().slice(0, 10);
    const endDay = now.toISOString().slice(0, 10);

    for (const illnessKey of illnessNames.keys()) {
      for (
        let dayTime = Date.parse(`${startDay}T00:00:00.000Z`);
        dayTime <= Date.parse(`${endDay}T00:00:00.000Z`);
        dayTime += dayMs
      ) {
        const day = new Date(dayTime).toISOString().slice(0, 10);
        const prescriptionCount = dailyCounts.get(`${illnessKey}:${day}`) || 0;
        if (prescriptionCount < MIN_ALERT_PRESCRIPTIONS) continue;

        let baselineCount = 0;
        for (let offset = 1; offset <= ALERT_BASELINE_DAYS; offset += 1) {
          const baselineDay = new Date(dayTime - offset * dayMs)
            .toISOString()
            .slice(0, 10);
          baselineCount += dailyCounts.get(`${illnessKey}:${baselineDay}`) || 0;
        }

        const baselineDailyAverage = baselineCount / ALERT_BASELINE_DAYS;
        if (
          baselineDailyAverage > 0 &&
          prescriptionCount < baselineDailyAverage * SPIKE_MULTIPLIER
        ) {
          continue;
        }

        const baselineEnd = new Date(dayTime - dayMs)
          .toISOString()
          .slice(0, 10);
        const baselineStart = new Date(dayTime - ALERT_BASELINE_DAYS * dayMs)
          .toISOString()
          .slice(0, 10);
        alerts.push({
          region: regionName,
          illnessCategory: illnessNames.get(illnessKey),
          alertDate: day,
          prescriptionCount,
          baseline: {
            startDate: baselineStart,
            endDate: baselineEnd,
            prescriptionCount: baselineCount,
            dailyAverage: Number(baselineDailyAverage.toFixed(2)),
          },
          spikeRatio:
            baselineDailyAverage > 0
              ? Number((prescriptionCount / baselineDailyAverage).toFixed(2))
              : null,
          detectionRule: {
            minimumPrescriptions: MIN_ALERT_PRESCRIPTIONS,
            spikeMultiplier: SPIKE_MULTIPLIER,
          },
          status: "active",
          signalMode: HEALTH_SIGNALS_MODE,
        });
      }
    }

    alerts.sort(
      (a, b) =>
        b.alertDate.localeCompare(a.alertDate) ||
        a.illnessCategory.localeCompare(b.illnessCategory),
    );
    return res.status(200).json(alerts);
  } catch (err) {
    console.error("GET /v1/health-signals/area-alerts error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------
// 4. POST /orders - Creates a New Customer Order
// -----------------------------------------------------------------------------
app.post("/orders", async (req, res) => {
  try {
    const { productId, quantity, customerName } = req.body;

    // --- API PARAMETER RESTRICTIONS & VALIDATION ---
    if (!productId || typeof productId !== "number") {
      return res.status(400).json({
        message: "Invalid payload. 'productId' must be a valid number.",
      });
    }

    if (!quantity || typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({
        message:
          "Invalid payload. 'quantity' must be a positive integer greater than 0.",
      });
    }

    // --- INSERT INTO DATABASE ---
    const { data, error } = await supabase
      .from("orders")
      .insert([
        {
          product_id: productId,
          quantity: quantity,
          customer_name: customerName || "Anonymous",
          status: "Pending",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase Error on /orders:", error.message);
      return res.status(400).json({ message: error.message });
    }

    // --- SUCCESS RESPONSE ---
    return res.status(201).json({
      message: "Order placed successfully",
      orderId: data.id,
      productId: data.product_id,
      quantity: data.quantity,
      customerName: data.customer_name,
      status: data.status,
      createdAt: data.created_at,
    });
  } catch (err) {
    console.error("POST /orders catch error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------
// Server Listener
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server is running successfully on port: ${PORT}`);
});
