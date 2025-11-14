# Convex Load Testing - Quick Reference

## Quick Start with npm Scripts

### Pre-configured Test Scenarios

```bash
# Light test - Safe for development (50 queries)
npm run load-test:light

# Medium test - Moderate load (500 queries)
npm run load-test:medium

# Heavy test - High load (2000 queries)
npm run load-test:heavy

# Advanced tests with different patterns
npm run load-test:small   # 1000 queries × 1 neighborhood
npm run load-test:large   # 500 queries × 50 neighborhoods
npm run load-test:mixed   # 1000 queries × mixed sizes
```

### Custom Tests

```bash
# Basic load test
node load-test.mjs [queries] [concurrency] [limit] [delay]

# Advanced load test
node load-test-advanced.mjs [pattern] [queries] [concurrency] [duration]
```

## Test Patterns

| Pattern | Results/Query | Best For |
|---------|---------------|----------|
| `small` | 1 neighborhood | High query volume, minimal bandwidth |
| `medium` | 10 neighborhoods | Typical application usage |
| `large` | 50 neighborhoods | Maximum data per query |
| `mixed` | 1-50 (varies) | Realistic usage patterns |

## Expected Performance

Based on test results:

```
Queries Per Second (QPS): 65-85
Average Latency: 85-160ms
P95 Latency: 78-411ms
Bandwidth per Query: 4-330 KB (depending on pattern)
```

## Free Tier Impact Calculator

| Test Size | Queries | Bandwidth | % of Monthly Limit |
|-----------|---------|-----------|-------------------|
| Light | 50 | ~1 MB | 0.1% bandwidth, 0.005% calls |
| Medium | 500 | ~10 MB | 1% bandwidth, 0.05% calls |
| Heavy | 2000 | ~40 MB | 4% bandwidth, 0.2% calls |
| Extreme | 10000 | ~200 MB | 20% bandwidth, 1% calls |

**Free Tier Limits:**
- Database Bandwidth: 1 GB/month
- Function Calls: 1 million/month

## Sample Commands

### Testing Scenarios

```bash
# Quick smoke test
node load-test.mjs 10 2 5

# Find maximum throughput
node load-test.mjs 1000 100 10

# Test with delays (simulate real usage)
node load-test.mjs 100 5 10 1000

# Run for 30 seconds continuously
node load-test-advanced.mjs mixed 0 20 30

# Stress bandwidth (large results)
node load-test-advanced.mjs large 1000 30

# Stress query volume (small results)
node load-test-advanced.mjs small 5000 50
```

### Interpreting Results

**Good Performance:**
- QPS > 50
- Avg Latency < 200ms
- P95 Latency < 500ms
- 0% failed queries

**Warning Signs:**
- Failed queries > 0%
- Avg Latency > 500ms
- QPS < 20
- P95 Latency > 1000ms

## Metrics Explained

### Performance Metrics
- **QPS**: Queries Per Second - how many queries completed
- **Latency**: Time from request to response
- **P95/P99**: 95th/99th percentile - worst-case performance
- **Throughput**: MB/s data transfer rate

### Latency Buckets
- `0-50ms`: Excellent (cached or simple queries)
- `50-100ms`: Good (normal performance)
- `100-200ms`: Acceptable (complex queries)
- `200-500ms`: Slow (investigate if common)
- `500ms+`: Very slow (investigate immediately)

## Troubleshooting

**High Latency:**
- First few queries are always slower (cold start)
- Check your network connection
- Reduce concurrency

**Failed Queries:**
- Convex may be rate limiting
- Reduce concurrency and add delays
- Check Convex dashboard for errors

**Low QPS:**
- Increase concurrency for more parallel queries
- Remove delays between batches

## Safety Guidelines

✅ **Safe to run anytime:**
- Light and medium tests
- Tests < 1000 queries
- Any test with delays > 100ms

⚠️ **Use with caution:**
- Heavy tests (2000+ queries)
- Tests without delays
- Continuous duration tests

❌ **Don't run repeatedly:**
- Extreme tests (10000+ queries)
- Tests that exceed 100 MB bandwidth
- Multiple concurrent test runs

## Monitoring

Check your usage in the Convex dashboard:
```bash
npm run predev  # Opens dashboard
```

Monitor:
1. Function calls (should stay well under 1M/month)
2. Database bandwidth (should stay under 1 GB/month)
3. Error rates (should be 0%)

## Examples with Expected Results

### Example 1: Quick Validation
```bash
npm run load-test:light
```
Expected: ~1 MB, 50 queries, 100% success, <200ms avg latency

### Example 2: Realistic Load
```bash
npm run load-test:mixed
```
Expected: ~10-20 MB, 1000 queries, 100% success, <150ms avg latency

### Example 3: Find Limits
```bash
node load-test.mjs 5000 100 50
```
Expected: ~100-200 MB, 5000 queries, watch for failures

### Example 4: Sustained Load
```bash
node load-test-advanced.mjs medium 0 10 60
```
Expected: Runs for 60 seconds, ~3000-5000 queries total
