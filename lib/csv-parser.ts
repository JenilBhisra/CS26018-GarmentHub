import { prisma } from "@/lib/prisma";
import { MarketDatasetStatus } from "@prisma/client";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import AdmZip from "adm-zip";
import csvParser from "csv-parser";
import { Readable, Transform } from "stream";

// Helper function to resolve header keys
function getHeaderKey(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Exact matches
  if (
    h === "category" || h === "categories" || h === "department" || 
    h === "dept" || h === "group" || h === "class" || h === "division"
  ) {
    return "category";
  }
  if (
    h === "price" || h === "mrp" || h === "retail" || 
    h === "cost" || h === "sellingprice" || h === "sellingpriceinr" ||
    h === "amount" || h === "amt" || h === "purchaseamountusd" || h === "priceusd"
  ) {
    return "price";
  }
  if (
    h === "demand" || h === "sales" || h === "search" || h === "trend" || 
    h === "orders" || h === "clicks" || h === "views" || h === "popularity" || h === "score" ||
    h === "count" || h === "qty" || h === "quantity"
  ) {
    return "demand";
  }
  if (
    h === "product" || h === "item" || h === "garment" || 
    h === "name" || h === "type" || h === "article" || h === "title" ||
    h === "itempurchased" || h === "productname"
  ) {
    return "product";
  }
  if (
    h === "season" || h === "month" || h === "year" || h === "date" || h === "quarter" ||
    h === "datepurchase" || h === "purchasedate"
  ) {
    return "season";
  }
  if (
    h === "rating" || h === "reviewrating" || h === "stars" || h === "review"
  ) {
    return "rating";
  }
  if (
    h === "gender" || h === "sex" || h === "target" || h === "audience" || 
    h === "targetaudience" || h === "demographic" || h === "gendergroup"
  ) {
    return "gender";
  }
  if (h === "color" || h === "colour") {
    return "color";
  }
  if (h === "size" || h === "sizes") {
    return "size";
  }

  // Loose / substring matches
  if (h.includes("cat") || h.includes("dept") || h.includes("div") || h.includes("group") || h.includes("class")) {
    return "category";
  }
  if (h.includes("price") || h.includes("val") || h.includes("cost") || h.includes("amount") || h.includes("amt")) {
    return "price";
  }
  if (h.includes("sales") || h.includes("trend") || h.includes("dem") || h.includes("qty") || h.includes("count") || h.includes("quantity")) {
    return "demand";
  }
  if (h.includes("prod") || h.includes("item") || h.includes("name") || h.includes("type")) {
    return "product";
  }
  if (h.includes("season") || h.includes("mon") || h.includes("date")) {
    return "season";
  }
  if (h.includes("rat") || h.includes("review") || h.includes("star")) {
    return "rating";
  }
  if (h.includes("gender") || h.includes("sex") || h.includes("demog")) {
    return "gender";
  }
  if (h.includes("color") || h.includes("colour")) {
    return "color";
  }
  if (h.includes("size")) {
    return "size";
  }

  return header;
}

// Dynamically unzip or gunzip and return a readable stream
async function getCsvReadStream(filePath: string, filesToDelete: string[]): Promise<Readable> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".gz" || ext === ".gzip") {
    return fs.createReadStream(filePath).pipe(zlib.createGunzip());
  } else if (ext === ".zip") {
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    const csvEntry = zipEntries.find(entry => entry.entryName.toLowerCase().endsWith(".csv"));
    if (!csvEntry) {
      throw new Error("No CSV file found inside the ZIP archive.");
    }
    
    const tempDir = path.dirname(filePath);
    const extractedFileName = `extracted-${Date.now()}-${csvEntry.name}`;
    const extractedPath = path.join(tempDir, extractedFileName);
    
    const buffer = csvEntry.getData();
    fs.writeFileSync(extractedPath, buffer);
    
    filesToDelete.push(extractedPath);
    return fs.createReadStream(extractedPath);
  } else {
    return fs.createReadStream(filePath);
  }
}

/**
 * Parses and processes a market dataset CSV file on disk to generate market insights.
 */
export async function processMarketDataset(datasetId: string, filePath: string) {
  // Update status to PROCESSING
  await prisma.marketDataset.update({
    where: { id: datasetId },
    data: { status: "PROCESSING" }
  });

  const startTime = Date.now();
  const BUCKET_SIZE = 50;
  const NUM_BUCKETS = 200; // up to 10,000 INR
  const priceHistogramBuckets = new Array(NUM_BUCKETS).fill(0);
  let overflowPriceCount = 0;

  // Running statistics
  const categories: Record<string, { count: number; demandSum: number; priceSum: number; priceCount: number }> = {};
  const seasonalDemand: Record<string, Record<string, number>> = {};
  const garments: Record<string, { count: number; demandSum: number }> = {};

  let priceSum = 0;
  let priceSquareSum = 0;
  let priceCount = 0;
  let priceMin = Infinity;
  let priceMax = -Infinity;

  // Data Quality Metrics
  let rowCount = 0;
  let rowsSkipped = 0;
  let duplicateRows = 0;
  let invalidPriceRows = 0;
  let invalidDateRows = 0;
  
  const duplicateSet = new Set<string>();
  let lastUpdateRows = 0;
  let parsedHeaders: string[] = [];

  const filesToDelete: string[] = []; // Only delete temporary extracted files
  let timerId: any = null;
  let readStream: Readable | null = null;

  try {
    readStream = await getCsvReadStream(filePath, filesToDelete);

    await new Promise<void>((resolve, reject) => {
      // 10-minute timeout safety limit
      timerId = setTimeout(() => {
        if (readStream) {
          readStream.destroy();
        }
        reject(new Error("Processing timed out. Safety limit: 10 minutes."));
      }, 10 * 60 * 1000);

      // Custom transform stream to skip comment lines (lines starting with '#')
      const commentSkipper = new (class extends Transform {
        private buffer: string = "";
        _transform(chunk: any, encoding: string, callback: any) {
          const data = this.buffer + chunk.toString("utf8");
          const lines = data.split(/\r?\n/);
          this.buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim().startsWith("#")) {
              this.push(line + "\n");
            }
          }
          callback();
        }
        _flush(callback: any) {
          if (this.buffer && !this.buffer.trim().startsWith("#")) {
            this.push(this.buffer + "\n");
          }
          callback();
        }
      })();

      const parser = readStream!.pipe(commentSkipper).pipe(
        csvParser({
          mapHeaders: ({ header }) => getHeaderKey(header)
        })
      );

      parser.on("headers", (headers) => {
        parsedHeaders = headers;
        console.log(`[CSV Parser] datasetId=${datasetId} — Parsed headers:`, headers);
      });

      parser.on("data", (row: any) => {
        rowCount++;

        // Safety limit: 5,000,000 rows
        if (rowCount > 5000000) {
          parser.destroy();
          reject(new Error("Dataset exceeds safety limit of 5,000,000 rows."));
          return;
        }

        // Live progress update to DB every 10,000 rows
        if (rowCount - lastUpdateRows >= 10000) {
          lastUpdateRows = rowCount;
          prisma.marketDataset.update({
            where: { id: datasetId },
            data: { rowCount, status: "PROCESSING" }
          }).catch((err) => {
            console.error("Failed to update progress in DB:", err);
          });
        }

        // 1. Data Quality Checks & Row deduplication
        const productVal = row["product"];
        const categoryVal = row["category"];
        const priceStr = row["price"];
        const demandStr = row["demand"];
        const seasonVal = row["season"];

        // Check for duplicates using a composite hash (capped Set for memory safety)
        const rowHash = `${productVal}-${categoryVal}-${priceStr}-${seasonVal}-${row["gender"]}-${row["color"]}-${row["size"]}`;
        if (duplicateSet.size < 150000) {
          if (duplicateSet.has(rowHash)) {
            duplicateRows++;
            // Don't skip, just register duplicate count for quality audit
          } else {
            duplicateSet.add(rowHash);
          }
        }

        // Validate completeness
        if (!categoryVal || !productVal || !priceStr || !seasonVal) {
          rowsSkipped++;
          return; // Skip malformed/incomplete row
        }

        // Parse & Validate price
        const priceVal = Number(priceStr);
        if (isNaN(priceVal) || priceVal <= 0) {
          invalidPriceRows++;
          rowsSkipped++;
          return;
        }

        // Parse & Validate demand
        const demandVal = demandStr ? Number(demandStr) || 1 : 1;

        // Parse & Validate season
        const seasonStr = String(seasonVal).trim();
        if (!seasonStr || ["null", "undefined", ""].includes(seasonStr.toLowerCase())) {
          invalidDateRows++;
          rowsSkipped++;
          return;
        }

        // 2. Accumulate stats
        const catStr = String(categoryVal).trim();
        if (!categories[catStr]) {
          categories[catStr] = { count: 0, demandSum: 0, priceSum: 0, priceCount: 0 };
        }
        categories[catStr].count++;
        categories[catStr].demandSum += demandVal;
        
        priceSum += priceVal;
        priceSquareSum += priceVal * priceVal;
        priceCount++;
        
        categories[catStr].priceSum += priceVal;
        categories[catStr].priceCount++;

        if (priceVal < priceMin) priceMin = priceVal;
        if (priceVal > priceMax) priceMax = priceVal;

        // Histogram bucket placement
        const bucketIndex = Math.floor(priceVal / BUCKET_SIZE);
        if (bucketIndex >= 0 && bucketIndex < NUM_BUCKETS) {
          priceHistogramBuckets[bucketIndex]++;
        } else {
          overflowPriceCount++;
        }

        // Seasonal stats
        if (!seasonalDemand[seasonStr]) {
          seasonalDemand[seasonStr] = {};
        }
        if (!seasonalDemand[seasonStr][catStr]) {
          seasonalDemand[seasonStr][catStr] = 0;
        }
        seasonalDemand[seasonStr][catStr] += demandVal;

        // Garment type stats
        const prodStr = String(productVal).trim();
        if (!garments[prodStr]) {
          garments[prodStr] = { count: 0, demandSum: 0 };
        }
        garments[prodStr].count++;
        garments[prodStr].demandSum += demandVal;
      });

      parser.on("end", () => {
        console.log(`[CSV Parser] datasetId=${datasetId} — Parsing complete. Total rows: ${rowCount}`);
        resolve();
      });

      parser.on("error", (err) => {
        console.error(`[CSV Parser] datasetId=${datasetId} — Parser error:`, err);
        reject(err);
      });
    });

    if (timerId) clearTimeout(timerId);

    const validRows = rowCount - rowsSkipped;
    if (validRows === 0) {
      throw new Error("CSV file contains no valid data rows.");
    }

    const insightsToCreate: any[] = [];
    const totalDemand = Object.values(categories).reduce((sum, c) => sum + c.demandSum, 0);

    // --- Insight 1: Trending Categories ---
    if (Object.keys(categories).length > 0) {
      const sortedCats = Object.entries(categories)
        .map(([name, data]) => {
          // Saturation = category listings / total valid listings
          const saturation = Math.round((data.count / validRows) * 100);
          return {
            name,
            demandScore: Math.min(100, Math.max(10, Math.round((data.demandSum / (totalDemand || 1)) * 100))),
            count: data.count,
            saturation,
            avgPrice: data.priceCount > 0 ? Math.round(data.priceSum / data.priceCount) : 0
          };
        })
        .sort((a, b) => b.demandScore - a.demandScore)
        .slice(0, 5);

      insightsToCreate.push({
        type: "TRENDING_CATEGORIES",
        title: "Trending Categories",
        description: "Categories displaying the highest demand and market search metrics.",
        value: sortedCats,
        score: 85
      });
    }

    // --- Insight 2: Price Range Analysis ---
    if (priceCount > 0) {
      const min = priceMin === Infinity ? 0 : priceMin;
      const max = priceMax === -Infinity ? 0 : priceMax;
      const avg = Math.round(priceSum / priceCount);
      
      // Calculate approximate median from the histogram
      let accumulated = 0;
      let median = min;
      const target = priceCount / 2;
      for (let i = 0; i < NUM_BUCKETS; i++) {
        accumulated += priceHistogramBuckets[i];
        if (accumulated >= target) {
          median = i * BUCKET_SIZE + BUCKET_SIZE / 2;
          break;
        }
      }
      if (accumulated < target) {
        median = avg; // fallback
      }

      // Calculate running standard deviation (plus/minus 1.2x stdDev centered around median)
      const variance = (priceSquareSum - (priceSum * priceSum / priceCount)) / priceCount;
      const stdDev = Math.sqrt(Math.max(0, variance));
      const rangeMin = Math.max(0, Math.round(median - 1.2 * stdDev));
      const rangeMax = Math.round(median + 1.2 * stdDev);

      insightsToCreate.push({
        type: "PRICE_RANGE_ANALYSIS",
        title: "Price Range Analysis",
        description: "Retail market price point distribution for popular garment items.",
        value: { 
          min, 
          max, 
          avg, 
          median, 
          count: priceCount,
          recommendedRange: { min: rangeMin, max: rangeMax } 
        },
        score: 70
      });
    }

    // --- Insight 3: Seasonal Opportunity ---
    if (Object.keys(seasonalDemand).length > 0) {
      const formattedSeasonal = Object.entries(seasonalDemand).map(([season, catData]) => {
        const topCategory = Object.entries(catData)
          .sort((a, b) => b[1] - a[1])[0];
        const seasonTotal = Object.values(catData).reduce((sum, d) => sum + d, 0);
        return {
          season,
          topCategory: topCategory ? topCategory[0] : "General",
          demandScore: topCategory ? Math.min(100, Math.round((topCategory[1] / (seasonTotal || 1)) * 100)) : 0
        };
      });

      insightsToCreate.push({
        type: "SEASONAL_OPPORTUNITY",
        title: "Seasonal Opportunities",
        description: "Analysis of category performance and demand spike across seasonal timelines.",
        value: formattedSeasonal,
        score: 75
      });
    }

    // --- Insight 4: Top Garment Types ---
    if (Object.keys(garments).length > 0) {
      const sortedGarments = Object.entries(garments)
        .map(([name, data]) => ({
          name,
          demandScore: Math.min(100, Math.max(10, Math.round((data.demandSum / (totalDemand || 1)) * 100))),
          count: data.count
        }))
        .sort((a, b) => b.demandScore - a.demandScore)
        .slice(0, 10); // Expand to top 10

      insightsToCreate.push({
        type: "TOP_GARMENTS",
        title: "Top Garment Types",
        description: "Highly ranked product and garment item types by consumer search popularity.",
        value: sortedGarments,
        score: 90
      });
    }

    // --- Insight 5: Market Opportunity Score & Focus Recommendations ---
    if (Object.keys(categories).length > 0) {
      const score = Math.min(100, Math.max(10, Math.round((totalDemand / (rowCount || 1)) * 50 + 40)));

      const recommendations = Object.entries(categories)
        .map(([name, data]) => {
          const avgPrice = data.priceCount > 0 ? data.priceSum / data.priceCount : 0;
          return {
            category: name,
            opportunityIndex: Math.min(100, Math.max(10, Math.round((data.demandSum / (totalDemand || 1)) * 100 + (avgPrice > 800 ? 15 : 5)))),
            avgPrice: Math.round(avgPrice)
          };
        })
        .sort((a, b) => b.opportunityIndex - a.opportunityIndex)
        .slice(0, 3);

      insightsToCreate.push({
        type: "MARKET_OPPORTUNITY_SCORE",
        title: "Market Opportunity Score",
        description: "Aggregated health index of category demand and profitability opportunities.",
        value: { score, recommendations },
        score: score
      });
    }

    // Deterministic Data Quality Checklist / Confidence Score Calculation
    const requiredColumns = ["category", "price", "demand", "product", "season"];
    const missingColumns = requiredColumns.filter(col => !parsedHeaders.includes(col));
    const confidenceScore = Math.max(50, Math.min(100, Math.round(
      100 - (missingColumns.length * 15) - (rowsSkipped / (rowCount || 1) * 50) - (invalidPriceRows > 0 ? 5 : 0) - (invalidDateRows > 0 ? 5 : 0)
    )));

    // Save insights inside a transaction
    await prisma.$transaction(async (tx) => {
      // Clear old insights of this dataset if any
      await tx.marketInsight.deleteMany({
        where: { datasetId }
      });

      // Save insights
      for (const ins of insightsToCreate) {
        const createdInsight = await tx.marketInsight.create({
          data: {
            datasetId,
            type: ins.type,
            title: ins.title,
            description: ins.description,
            value: ins.value,
            score: ins.score
          }
        });

        // Generate recommendations for the general list
        if (ins.type === "MARKET_OPPORTUNITY_SCORE") {
          const recs = ins.value.recommendations || [];
          for (const rec of recs) {
            await tx.insightRecommendation.create({
              data: {
                marketInsightId: createdInsight.id,
                title: `Expand into: ${rec.category}`,
                description: `High opportunity index (${rec.opportunityIndex}) detected based on average price point ${rec.avgPrice} INR.`,
                priority: rec.opportunityIndex > 60 ? "HIGH" : "MEDIUM",
                status: "OPEN"
              }
            });
          }
        }
      }

      // Mark dataset as COMPLETED and save quality report
      await tx.marketDataset.update({
        where: { id: datasetId },
        data: {
          status: "COMPLETED",
          rowCount,
          columns: parsedHeaders as any,
          processedAt: new Date(),
          qualityReport: {
            rowsProcessed: rowCount,
            rowsSkipped,
            duplicateRows,
            invalidPriceRows,
            invalidDateRows,
            missingColumns,
            detectedColumns: parsedHeaders,
            processingTimeMs: Date.now() - startTime,
            confidenceScore
          } as any
        }
      });
    });

    console.log(`[CSV Parser] datasetId=${datasetId} — Processing COMPLETED. Rows: ${rowCount}, Insights: ${insightsToCreate.length}, Confidence: ${confidenceScore}%`);

  } catch (err: any) {
    console.error("processMarketDataset failed:", err);
    if (timerId) clearTimeout(timerId);

    await prisma.marketDataset.update({
      where: { id: datasetId },
      data: {
        status: "FAILED",
        errorMessage: err.message || "An unexpected error occurred during CSV processing."
      }
    }).catch(() => null);
  } finally {
    // Delete only the temporary extracted files (e.g. unzipped CSVs) to keep original ZIP/GZIP/CSV intact for reprocessing
    for (const f of filesToDelete) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch (err) {
          console.error(`Failed to delete temp extracted file ${f}:`, err);
        }
      }
    }
  }
}
