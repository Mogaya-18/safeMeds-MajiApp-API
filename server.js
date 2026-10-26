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
  console.error("❌ Error: SupaBASE_URL or SUPABASE_KEY missing in .env file!");
}

const supabase = createClient(supabaseURL, supabaseKEY);

// 1. GET/inventory
app.get("/inventory", async (req, res) => {
  try {
    const { product, available } = req.query;

    // Fetch items that match the category Water Purification.
    let query = supabase
      .from("inventory")
      .select("*")
      .ilike("category", WATER_CATEGORY);

    if (product) {
      query = query.ilike("item_name", `%${product}%`);
    }

    const { data: rows, error } = await query;

    // 2. Print raw output directly to your terminal screen
    console.log("--- DB DEBUG LOG ---");
    console.log("Error from Supabase:", error);
    console.log("Rows returned from Supabase:", rows);

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // Map database coloumns to OpenAPI contract fields.
    let responseData = rows.map((item) => ({
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
    return res.status(500).json({ message: "Internal server error" });
  }
});

// 2. PATCH /medications/:id/stock
// Updates stock quantity for a Water Purification medication.
app.patch("/medications/:id/stock", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { stockQuantity } = req.body;

    // Validate payload
    if (
      isNaN(id) ||
      stockQuantity === undefined ||
      typeof stockQuantity !== "number" ||
      stockQuantity < 0
    ) {
      return res.status(400).json({
        message: "stockQuantity must be an integer greator than or equal to 0",
      });
    }

    // Verify item exits and belongs to 'Water Purification'
    const { data: existingItem, error: fetchError } = await supabase
      .from("inventory")
      .select("*")
      .eq("id", id)
      .single();

    if (
      fetchError ||
      !existingItem ||
      existingItem.category !== WATER_CATEGORY
    ) {
      return res.status(404).json({
        message: `Medication with ID ${id} not found under ${WATER_CATEGORY}`,
      });
    }

    // Perform update in supabase
    const { data: updateData, error: updateError } = await supabase
      .from("inventory")
      .update({ current_stock: stockQuantity })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ message: updateError.message });
    }

    // Return structured contract response
    return res.status(200).json({
      productId: updateData.id,
      productName: updateData.item_name,
      stockQuantity: updateData.current_stock,
      productCategory: updateData.category.toLowerCase().replace(/\s+/g, "-"),
    });
  } catch (err) {
    return res.status(500).json({ message: "Internal Sever Error" });
  }
});

// 3. The port
app.listen(PORT, () => {
  console.log(`Server is running successfully on port: ${PORT}`);
});
