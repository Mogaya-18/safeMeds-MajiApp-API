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

const supabaseURL = process.env.SUPABASE_URL;
const supabaseKEY = process.env.SUPABASE_KEY;

if (!supabaseURL || !supabaseKEY) {
  console.error("❌ Error: SUPABASE_URL or SUPABASE_KEY missing in .env file!");
}

const supabase = createClient(supabaseURL, supabaseKEY);

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
// 3. POST /orders - Creates a New Customer Order
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
