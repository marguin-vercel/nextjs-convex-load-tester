# Convex Database Load Testing

Two load testing scripts to stress test your Convex database with the neighborhoods data.

## Scripts

### 1. Basic Load Test (`load-test.mjs`)
Simple load testing with configurable parameters.

**Usage:**
```bash
node load-test.mjs [totalQueries] [concurrency] [queryLimit] [delayMs]
```

**Parameters:**
- `totalQueries` - Total number of queries to execute (default: 100)
- `concurrency` - Number of concurrent queries (default: 10)
- `queryLimit` - Neighborhoods returned per query (default: 10)
- `delayMs` - Delay between batches in milliseconds (default: 0)

**Examples:**
```bash
# Run 100 queries, 10 at a time, returning 10 neighborhoods each
node load-test.mjs 100 10 10

# Stress test: 1000 queries, 50 concurrent, return 50 neighborhoods each
node load-test.mjs 1000 50 50

# Gentle test: 50 queries, 5 concurrent, with 100ms delay between batches
node load-test.mjs 50 5 10 100

# Maximum stress: 5000 queries, 100 concurrent
node load-test.mjs 5000 100 10
```

### 2. Advanced Load Test (`load-test-advanced.mjs`)
More sophisticated testing with different query patterns and detailed metrics.

**Usage:**
```bash
node load-test-advanced.mjs [pattern] [totalQueries] [concurrency] [duration]
```

**Parameters:**
- `pattern` - Test pattern: `small`, `medium`, `large`, or `mixed` (default: medium)
- `totalQueries` - Total queries to execute (default: 100)
- `concurrency` - Concurrent queries (default: 10)
- `duration` - Run for N seconds (0 = use totalQueries)

**Test Patterns:**
- `small` - 1 neighborhood per query (high volume, low bandwidth)
- `medium` - 10 neighborhoods per query (typical usage)
- `large` - 50 neighborhoods per query (high bandwidth)
- `mixed` - Varies between 1-50 neighborhoods (realistic usage)

**Examples:**
```bash
# Medium queries (typical usage)
node load-test-advanced.mjs medium 100 10

# Small queries (minimal bandwidth, maximum query volume)
node load-test-advanced.mjs small 1000 50

# Large queries (maximum bandwidth per query)
node load-test-advanced.mjs large 500 20

# Mixed pattern (realistic usage)
node load-test-advanced.mjs mixed 1000 25

# Run for 30 seconds with mixed pattern
node load-test-advanced.mjs mixed 0 10 30
```

## Metrics Tracked

### Basic Load Test
- Total duration
- Queries per second (QPS)
- Average/min/max latency
- Success/failure rates
- Total bandwidth usage
- Free tier impact percentage

### Advanced Load Test
Additional metrics:
- Median latency (P50)
- P95 and P99 latency percentiles
- Latency distribution histogram
- Per-query bandwidth stats
- Estimated monthly impact if sustained

## Understanding Results

### Free Tier Limits
- **Database Bandwidth:** 1 GB/month
- **Function Calls:** 1 million/month
- **Storage:** 0.5 GB

### Safe Test Ranges

**Light Testing (won't impact free tier):**
```bash
node load-test.mjs 100 10 10
# ~0.2 MB bandwidth, 100 function calls
```

**Moderate Testing:**
```bash
node load-test.mjs 1000 20 10
# ~2 MB bandwidth, 1000 function calls
```

**Heavy Testing (approaching limits):**
```bash
node load-test.mjs 5000 50 50
# ~50-100 MB bandwidth, 5000 function calls
```

**Extreme Testing (will exceed free tier):**
```bash
node load-test.mjs 50000 100 50
# ~1+ GB bandwidth, 50000 function calls
```

## Sample Output

```
🔥 Convex Advanced Load Test

Configuration:
  Pattern: Mixed Pattern
  Description: Simulates realistic mixed query patterns
  Total Queries: 1000
  Concurrency: 25

============================================================

⚡ Queries: 1000 | Elapsed: 15.3s | QPS: 65.4 | Avg Latency: 45ms | Success: 1000 | Failed: 0

============================================================

📊 Detailed Load Test Results

⚡ Performance Metrics:
  Total Duration: 15.32s
  Queries Per Second: 65.36
  Average Latency: 45.23ms
  Median Latency: 42ms
  P95 Latency: 78ms
  P99 Latency: 95ms
  Min Latency: 28ms
  Max Latency: 112ms

📈 Latency Distribution:
  0-50ms       ████████████████████████ 61.2% (612)
  50-100ms     ████████████ 30.8% (308)
  100-200ms    ████ 7.5% (75)
  200-500ms    ▌ 0.5% (5)
  500ms+       0.0% (0)

📊 Query Statistics:
  Total Queries: 1000
  ✅ Successful: 1000 (100.0%)
  ❌ Failed: 0 (0.0%)

🌐 Bandwidth Usage:
  Total Data Transferred: 15.23 MB
  Transfer Rate: 0.99 MB/s
  Average per Query: 15.23 KB

💰 Free Tier Impact:
  Database Bandwidth: 1.487% of 1 GB/month limit
  Function Calls: 0.100% of 1M/month limit
```

## Best Practices

1. **Start Small:** Begin with 100 queries to establish baseline
2. **Increase Gradually:** Double queries each test to find limits
3. **Monitor Errors:** Watch for failures indicating rate limits
4. **Check Dashboard:** Use Convex dashboard to see real-time impact
5. **Respect Limits:** Don't repeatedly max out free tier in testing

## Troubleshooting

**"Rate limit exceeded" errors:**
- Reduce concurrency
- Add delay between batches
- Decrease total queries

**Slow performance:**
- Check network connection
- Reduce query limit
- Lower concurrency

**High bandwidth usage:**
- Use `small` pattern for high-volume tests
- Reduce neighborhoods returned per query
- Add delays between queries

## Cleanup

These scripts are read-only and don't modify your database. They only query existing data.
