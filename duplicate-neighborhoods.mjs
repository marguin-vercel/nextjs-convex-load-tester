import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("Error: NEXT_PUBLIC_CONVEX_URL not found in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// Define variant suffixes to create ~25 variants per neighborhood
const VARIANT_SUFFIXES = [
  "North",
  "South",
  "East",
  "West",
  "Central",
  "District 1",
  "District 2",
  "District 3",
  "District 4",
  "District 5",
  "District 6",
  "District 7",
  "District 8",
  "District 9",
  "District 10",
  "District 11",
  "District 12",
  "District 13",
  "District 14",
  "District 15",
  "District 16",
  "District 17",
  "District 18",
  "District 19",
  "District 20",
];

async function duplicateNeighborhoods() {
  console.log("Reading neighborhoods.json...");
  const fileContent = fs.readFileSync("neighborhoods.json", "utf8");

  // Parse NDJSON format (newline-delimited JSON)
  const baseData = fileContent
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  console.log(`Found ${baseData.length} base neighborhoods`);
  console.log(`Creating ${VARIANT_SUFFIXES.length} variants for each...`);

  const totalExpected = baseData.length * VARIANT_SUFFIXES.length;
  console.log(`Expected total: ${totalExpected} neighborhoods\n`);

  // Create variants
  const allNeighborhoods = [];
  for (const base of baseData) {
    for (const suffix of VARIANT_SUFFIXES) {
      allNeighborhoods.push({
        name: `${base.name} ${suffix}`,
        geometry: base.geometry,
      });
    }
  }

  console.log(`Generated ${allNeighborhoods.length} neighborhood variants`);

  // Import in batches of 50 to avoid overwhelming the system
  const batchSize = 50;
  let imported = 0;

  for (let i = 0; i < allNeighborhoods.length; i += batchSize) {
    const batch = allNeighborhoods.slice(i, i + batchSize);

    try {
      const result = await client.mutation(api.neighborhoods.importNeighborhoods, {
        neighborhoods: batch,
      });
      imported += result.count;
      const progress = ((imported / allNeighborhoods.length) * 100).toFixed(1);
      console.log(`Imported ${imported}/${allNeighborhoods.length} neighborhoods (${progress}%)...`);
    } catch (error) {
      console.error(`Error importing batch ${i / batchSize + 1}:`, error);
      throw error;
    }
  }

  console.log(`\n✅ Successfully imported ${imported} neighborhood variants!`);
  console.log(`✅ Total neighborhoods in database: ${195 + imported} (195 original + ${imported} variants)`);

  // Show first 10 neighborhoods as a sample
  const sample = await client.query(api.neighborhoods.listNeighborhoods, {
    limit: 10,
  });
  console.log("\nSample neighborhoods:");
  sample.forEach((n) => console.log(`  - ${n.name}`));
}

duplicateNeighborhoods()
  .then(() => {
    console.log("\n✨ Duplication completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Duplication failed:", error);
    process.exit(1);
  });
