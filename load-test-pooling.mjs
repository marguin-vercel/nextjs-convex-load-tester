import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("Error: NEXT_PUBLIC_CONVEX_URL not found in .env.local");
  process.exit(1);
}

// Test patterns
const TEST_PATTERNS = {
  small: {
    name: "Small Queries (1 neighborhood)",
    limit: 1,
    description: "Tests high query volume with minimal data transfer"
  },
  medium: {
    name: "Medium Queries (10 neighborhoods)",
    limit: 10,
    description: "Simulates typical application usage"
  },
  large: {
    name: "Large Queries (50 neighborhoods)",
    limit: 50,
    description: "Tests bandwidth and processing of large result sets"
  },
  mixed: {
    name: "Mixed Pattern",
    limits: [1, 5, 10, 25, 50],
    description: "Simulates realistic mixed query patterns"
  }
};

// Configuration
const CONFIG = {
  pattern: process.argv[2] || 'medium',
  totalQueries: parseInt(process.argv[3]) || 100,
  concurrency: parseInt(process.argv[4]) || 10,
};

// Statistics for each test mode
function createStats() {
  return {
    queries: [],
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    totalBytesTransferred: 0,
    totalLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    errors: [],
    startTime: 0,
    endTime: 0,
    latencyBuckets: {
      "0-50ms": 0,
      "50-100ms": 0,
      "100-200ms": 0,
      "200-500ms": 0,
      "500ms+": 0,
    },
  };
}

// Execute a single query with SHARED client (connection reuse)
async function executeQueryWithSharedClient(sharedClient, queryNum, limit, stats) {
  const startTime = Date.now();
  try {
    const result = await sharedClient.query(api.neighborhoods.listNeighborhoods, { limit });

    const latency = Date.now() - startTime;
    const bytesTransferred = JSON.stringify(result).length;

    // Update statistics
    stats.successfulQueries++;
    stats.totalBytesTransferred += bytesTransferred;
    stats.totalLatency += latency;
    stats.minLatency = Math.min(stats.minLatency, latency);
    stats.maxLatency = Math.max(stats.maxLatency, latency);

    // Latency buckets
    if (latency < 50) stats.latencyBuckets["0-50ms"]++;
    else if (latency < 100) stats.latencyBuckets["50-100ms"]++;
    else if (latency < 200) stats.latencyBuckets["100-200ms"]++;
    else if (latency < 500) stats.latencyBuckets["200-500ms"]++;
    else stats.latencyBuckets["500ms+"]++;

    stats.queries.push({ queryNum, latency, bytes: bytesTransferred, limit });

    return { success: true, latency, bytes: bytesTransferred };
  } catch (error) {
    stats.failedQueries++;
    stats.errors.push({ queryNum, error: error.message });
    return { success: false, error: error.message };
  } finally {
    stats.totalQueries++;
  }
}

// Execute a single query with NEW client (no connection reuse)
async function executeQueryWithNewClient(queryNum, limit, stats) {
  const startTime = Date.now();
  try {
    // Create a new client for each request
    const newClient = new ConvexHttpClient(CONVEX_URL);
    const result = await newClient.query(api.neighborhoods.listNeighborhoods, { limit });

    const latency = Date.now() - startTime;
    const bytesTransferred = JSON.stringify(result).length;

    // Update statistics
    stats.successfulQueries++;
    stats.totalBytesTransferred += bytesTransferred;
    stats.totalLatency += latency;
    stats.minLatency = Math.min(stats.minLatency, latency);
    stats.maxLatency = Math.max(stats.maxLatency, latency);

    // Latency buckets
    if (latency < 50) stats.latencyBuckets["0-50ms"]++;
    else if (latency < 100) stats.latencyBuckets["50-100ms"]++;
    else if (latency < 200) stats.latencyBuckets["100-200ms"]++;
    else if (latency < 500) stats.latencyBuckets["200-500ms"]++;
    else stats.latencyBuckets["500ms+"]++;

    stats.queries.push({ queryNum, latency, bytes: bytesTransferred, limit });

    return { success: true, latency, bytes: bytesTransferred };
  } catch (error) {
    stats.failedQueries++;
    stats.errors.push({ queryNum, error: error.message });
    return { success: false, error: error.message };
  } finally {
    stats.totalQueries++;
  }
}

// Get limit for current query based on pattern
function getQueryLimit(queryNum) {
  const pattern = TEST_PATTERNS[CONFIG.pattern];

  if (CONFIG.pattern === 'mixed') {
    return pattern.limits[queryNum % pattern.limits.length];
  }

  return pattern.limit;
}

// Run load test with a specific client strategy
async function runLoadTest(mode, executeQueryFn, sharedClient = null) {
  const stats = createStats();
  const pattern = TEST_PATTERNS[CONFIG.pattern];

  console.log(`\n🔥 Testing: ${mode}\n`);
  console.log("Configuration:");
  console.log(`  Pattern: ${pattern.name}`);
  console.log(`  Description: ${pattern.description}`);
  console.log(`  Total Queries: ${CONFIG.totalQueries}`);
  console.log(`  Concurrency: ${CONFIG.concurrency}`);
  console.log("\n" + "=".repeat(60) + "\n");

  stats.startTime = Date.now();
  let queryCount = 0;

  while (queryCount < CONFIG.totalQueries) {
    const batch = [];
    const batchSize = Math.min(CONFIG.concurrency, CONFIG.totalQueries - queryCount);

    for (let i = 0; i < batchSize; i++) {
      const limit = getQueryLimit(queryCount + i);
      if (sharedClient) {
        batch.push(executeQueryFn(sharedClient, queryCount + i + 1, limit, stats));
      } else {
        batch.push(executeQueryFn(queryCount + i + 1, limit, stats));
      }
    }

    await Promise.all(batch);
    queryCount += batchSize;

    // Progress update
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    const qps = (stats.totalQueries / elapsed).toFixed(1);
    const avgLatency = stats.successfulQueries > 0
      ? (stats.totalLatency / stats.successfulQueries).toFixed(0)
      : 0;

    process.stdout.write(
      `\r⚡ Queries: ${stats.totalQueries} | ` +
      `Elapsed: ${elapsed}s | ` +
      `QPS: ${qps} | ` +
      `Avg Latency: ${avgLatency}ms | ` +
      `Success: ${stats.successfulQueries} | ` +
      `Failed: ${stats.failedQueries}   `
    );
  }

  stats.endTime = Date.now();
  console.log("\n\n" + "=".repeat(60) + "\n");

  return stats;
}

// Calculate median latency
function calculateMedianLatency(stats) {
  if (stats.queries.length === 0) return 0;
  const latencies = stats.queries.map(q => q.latency).sort((a, b) => a - b);
  const mid = Math.floor(latencies.length / 2);
  return latencies.length % 2 === 0
    ? ((latencies[mid - 1] + latencies[mid]) / 2).toFixed(0)
    : latencies[mid].toFixed(0);
}

// Calculate percentile latency
function calculatePercentile(stats, percentile) {
  if (stats.queries.length === 0) return 0;
  const latencies = stats.queries.map(q => q.latency).sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * latencies.length) - 1;
  return latencies[index]?.toFixed(0) || 0;
}

// Display results for a single test
function displayResults(mode, stats) {
  const totalDuration = (stats.endTime - stats.startTime) / 1000;
  const queriesPerSecond = (stats.totalQueries / totalDuration).toFixed(2);
  const avgLatency = stats.successfulQueries > 0
    ? (stats.totalLatency / stats.successfulQueries).toFixed(2)
    : 0;
  const totalMB = (stats.totalBytesTransferred / 1024 / 1024).toFixed(2);

  console.log(`📊 ${mode} Results\n`);

  console.log("⚡ Performance Metrics:");
  console.log(`  Total Duration: ${totalDuration.toFixed(2)}s`);
  console.log(`  Queries Per Second: ${queriesPerSecond}`);
  console.log(`  Average Latency: ${avgLatency}ms`);
  console.log(`  Median Latency: ${calculateMedianLatency(stats)}ms`);
  console.log(`  P95 Latency: ${calculatePercentile(stats, 95)}ms`);
  console.log(`  P99 Latency: ${calculatePercentile(stats, 99)}ms`);
  console.log(`  Min Latency: ${stats.minLatency === Infinity ? 0 : stats.minLatency}ms`);
  console.log(`  Max Latency: ${stats.maxLatency}ms`);

  console.log("\n📈 Latency Distribution:");
  Object.entries(stats.latencyBuckets).forEach(([bucket, count]) => {
    const percentage = stats.successfulQueries > 0
      ? ((count / stats.successfulQueries) * 100).toFixed(1)
      : 0;
    const bar = "█".repeat(Math.floor(percentage / 2));
    console.log(`  ${bucket.padEnd(12)} ${bar} ${percentage}% (${count})`);
  });

  console.log("\n📊 Query Statistics:");
  console.log(`  Total Queries: ${stats.totalQueries}`);
  console.log(`  ✅ Successful: ${stats.successfulQueries} (${((stats.successfulQueries/stats.totalQueries)*100).toFixed(1)}%)`);
  console.log(`  ❌ Failed: ${stats.failedQueries} (${((stats.failedQueries/stats.totalQueries)*100).toFixed(1)}%)`);

  console.log("\n🌐 Bandwidth Usage:");
  console.log(`  Total Data Transferred: ${totalMB} MB`);

  if (stats.errors.length > 0) {
    console.log("\n⚠️  Errors:");
    stats.errors.slice(0, 3).forEach(err => {
      console.log(`  Query #${err.queryNum}: ${err.error}`);
    });
    if (stats.errors.length > 3) {
      console.log(`  ... and ${stats.errors.length - 3} more errors`);
    }
  }

  console.log("\n" + "=".repeat(60) + "\n");

  return {
    duration: totalDuration,
    qps: parseFloat(queriesPerSecond),
    avgLatency: parseFloat(avgLatency),
    medianLatency: parseFloat(calculateMedianLatency(stats)),
    p95Latency: parseFloat(calculatePercentile(stats, 95)),
    p99Latency: parseFloat(calculatePercentile(stats, 99)),
    minLatency: stats.minLatency === Infinity ? 0 : stats.minLatency,
    maxLatency: stats.maxLatency,
    totalMB: parseFloat(totalMB),
  };
}

// Display comparison
function displayComparison(sharedResults, newClientResults) {
  console.log("📊 COMPARISON: Shared Client vs New Client Per Request\n");
  console.log("=" .repeat(80) + "\n");

  console.log("⚡ Performance Comparison:\n");

  const metrics = [
    { name: "Average Latency", unit: "ms", shared: sharedResults.avgLatency, newClient: newClientResults.avgLatency, lowerIsBetter: true },
    { name: "Median Latency", unit: "ms", shared: sharedResults.medianLatency, newClient: newClientResults.medianLatency, lowerIsBetter: true },
    { name: "P95 Latency", unit: "ms", shared: sharedResults.p95Latency, newClient: newClientResults.p95Latency, lowerIsBetter: true },
    { name: "P99 Latency", unit: "ms", shared: sharedResults.p99Latency, newClient: newClientResults.p99Latency, lowerIsBetter: true },
    { name: "Min Latency", unit: "ms", shared: sharedResults.minLatency, newClient: newClientResults.minLatency, lowerIsBetter: true },
    { name: "Max Latency", unit: "ms", shared: sharedResults.maxLatency, newClient: newClientResults.maxLatency, lowerIsBetter: true },
    { name: "Queries Per Second", unit: "QPS", shared: sharedResults.qps, newClient: newClientResults.qps, lowerIsBetter: false },
    { name: "Total Duration", unit: "s", shared: sharedResults.duration, newClient: newClientResults.duration, lowerIsBetter: true },
  ];

  metrics.forEach(metric => {
    const diff = metric.shared - metric.newClient;
    const percentDiff = ((diff / metric.newClient) * 100).toFixed(1);

    let winner = "";
    if (metric.lowerIsBetter) {
      winner = metric.shared < metric.newClient ? "✅ Shared Client Faster" : "⚠️ New Client Faster";
    } else {
      winner = metric.shared > metric.newClient ? "✅ Shared Client Faster" : "⚠️ New Client Faster";
    }

    console.log(`${metric.name}:`);
    console.log(`  Shared Client:     ${metric.shared.toFixed(2)} ${metric.unit}`);
    console.log(`  New Client/Request: ${metric.newClient.toFixed(2)} ${metric.unit}`);
    console.log(`  Difference:         ${Math.abs(diff).toFixed(2)} ${metric.unit} (${Math.abs(percentDiff)}%)`);
    console.log(`  ${winner}\n`);
  });

  console.log("=" .repeat(80) + "\n");

  console.log("💡 Summary:\n");
  const avgLatencyImprovement = ((newClientResults.avgLatency - sharedResults.avgLatency) / newClientResults.avgLatency * 100).toFixed(1);
  const qpsImprovement = ((sharedResults.qps - newClientResults.qps) / newClientResults.qps * 100).toFixed(1);

  if (parseFloat(avgLatencyImprovement) > 0) {
    console.log(`  ✅ Shared Client is ${avgLatencyImprovement}% FASTER in average latency`);
  } else {
    console.log(`  ⚠️  New Client per request is ${Math.abs(avgLatencyImprovement)}% faster in average latency`);
  }

  if (parseFloat(qpsImprovement) > 0) {
    console.log(`  ✅ Shared Client has ${qpsImprovement}% HIGHER throughput (QPS)`);
  } else {
    console.log(`  ⚠️  New Client per request has ${Math.abs(qpsImprovement)}% higher throughput (QPS)`);
  }

  console.log("\n  💡 Recommendation:");
  if (parseFloat(avgLatencyImprovement) > 5 || parseFloat(qpsImprovement) > 5) {
    console.log("     Use a SHARED CLIENT (connection reuse) for better performance.");
  } else {
    console.log("     Both approaches have similar performance for this workload.");
  }

  console.log("\n" + "=" .repeat(80));
}

// Main execution
async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🔬 Convex Connection Pooling Comparison Test");
  console.log("=".repeat(80));
  console.log("\nThis test compares two connection strategies:");
  console.log("  1. Shared Client: Reuses a single ConvexHttpClient (connection reuse)");
  console.log("  2. New Client: Creates a new ConvexHttpClient per request (no reuse)");
  console.log("\n" + "=".repeat(80) + "\n");

  // Test 1: Shared client (connection reuse)
  const sharedClient = new ConvexHttpClient(CONVEX_URL);
  const statsShared = await runLoadTest(
    "SHARED CLIENT (Connection Reuse)",
    executeQueryWithSharedClient,
    sharedClient
  );
  const sharedResults = displayResults("SHARED CLIENT (Connection Reuse)", statsShared);

  // Small delay between tests
  console.log("⏳ Waiting 2 seconds before next test...\n");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: New client per request (no connection reuse)
  const statsNewClient = await runLoadTest(
    "NEW CLIENT PER REQUEST (No Connection Reuse)",
    executeQueryWithNewClient
  );
  const newClientResults = displayResults("NEW CLIENT PER REQUEST (No Connection Reuse)", statsNewClient);

  // Display comparison
  displayComparison(sharedResults, newClientResults);
}

// Run the comparison test
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Load test failed:", error);
    process.exit(1);
  });
