const express = require("express");
const cors = require("cors");
const csv = require("csv-parser");
const multer = require("multer");
const path = require("path");
const { Readable } = require("stream");

const app = express();
const PORT = 3001;

app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "..", "frontend", "dist")));

let inventory = [];

// Upload CSV
app.post("/api/upload", upload.single("file"), (req, res) => {
  const results = [];

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const bufferStream = Readable.from([req.file.buffer]);

  bufferStream
    .pipe(csv())
    .on("data", (row) => {
      results.push(row);
    })
    .on("end", () => {
      inventory = results;
      res.json({ count: results.length, message: "Inventory loaded successfully" });
    });
});

// Get inventory
app.get("/api/inventory", (req, res) => {
  res.json(inventory);
});

// Apply baseline pricing
app.post("/api/pricing/baseline", (req, res) => {
  const { percent = 105, shippingCost = 0.70 } = req.body;
  const multiplier = percent / 100;

  const updated = inventory.map((item) => {
    const marketPrice = parseFloat(item["TCG Market Price"]) || 0;
    const lowWithShip = parseFloat(item["TCG Low Price With Shipping"]) || 0;

    // "whichever is greater: market price or tcg low + ship minus shipping cost"
    const shipOption = lowWithShip > 0 ? lowWithShip - shippingCost : 0;

    // Take whichever is greater, then apply multiplier
    let price = Math.max(marketPrice, shipOption) * multiplier;

    // Round to 2 decimal places
    price = Math.round(price * 100) / 100;

    return { ...item, "TCG Marketplace Price": price.toFixed(2) };
  });

  inventory = updated;
  res.json({ message: "Baseline pricing applied", count: updated.length });
});

// Apply bulk pricing rules
app.post("/api/pricing/apply", (req, res) => {
  const { rules } = req.body;

  if (!rules || !Array.isArray(rules)) {
    return res.status(400).json({ error: "Rules must be an array" });
  }

  const updated = inventory.map((item) => {
    let price = parseFloat(item["TCG Marketplace Price"]) || 0;
    const quantity = parseInt(item["Total Quantity"]) || 0;

    for (const rule of rules) {
      if (rule.condition === "quantity" && rule.operator === "gte" && quantity >= rule.value) {
        // Increase price by percentage
        price = price * (1 + rule.percent / 100);
      }
    }

    // Round to 2 decimal places
    price = Math.round(price * 100) / 100;

    return { ...item, "TCG Marketplace Price": price.toFixed(2) };
  });

  inventory = updated;
  res.json({ message: "Pricing rules applied", count: updated.length });
});

// Export updated CSV
app.get("/api/export", (req, res) => {
  if (inventory.length === 0) {
    return res.status(400).json({ error: "No inventory to export" });
  }

  const headers = Object.keys(inventory[0]);
  const csvContent =
    headers.join(",") +
    "\n" +
    inventory
      .map((row) =>
        headers
          .map((header) => {
            const value = String(row[header] ?? "");
            return value.includes(",") ? `"${value}"` : value;
          })
          .join(",")
      )
      .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=inventory_pricing_updated.csv");
  res.send(csvContent);
});

// Catch-all for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
