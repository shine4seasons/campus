# PERF-201 Local Benchmark Summary

- Date: 2026-05-23T14:45:38.264Z
- Matrix artifact: `docs\perf-endpoint-matrix.local.json`
- Benchmark artifact: `docs\evidence\bench-p95-local-20260523-214537.json`
- Benchmark exit code: 1

## Notes
- App must already be running at `BENCH_BASE_URL`.
- Cookies in `BENCH_BUYER_COOKIE` and `BENCH_ADMIN_COOKIE` must be valid for success-path benchmarking.

```text
{
  "date": "2026-05-23T14:45:38.245Z",
  "baseUrl": "http://localhost:5000",
  "method": "GET",
  "warmupRequests": 3,
  "headerKeys": [],
  "hasEndpointMatrix": true,
  "requestsPerEndpoint": 25,
  "concurrency": 5,
  "ok": false,
  "results": [
    {
      "endpoint": "/api/products",
      "method": "GET",
      "samples": 0,
      "successSamples": 0,
      "errors": 25,
      "statusCounts": {},
      "p50": null,
      "p95": null,
      "p99": null,
      "successP50": null,
      "successP95": null,
      "successP99": null,
      "reachable": false,
      "meaningful": false,
      "authOnlyStatuses": false,
      "disallowedStatuses": [],
      "allowStatuses": [
        "200"
      ],
      "successStatuses": [
        "200"
      ]
    },
    {
      "endpoint": "/api/chat",
      "method": "GET",
      "samples": 0,
      "successSamples": 0,
      "errors": 25,
      "statusCounts": {},
      "p50": null,
      "p95": null,
      "p99": null,
      "successP50": null,
      "successP95": null,
      "successP99": null,
      "reachable": false,
      "meaningful": false,
      "authOnlyStatuses": false,
      "disallowedStatuses": [],
      "allowStatuses": [
        "200"
      ],
      "successStatuses": [
        "200"
      ]
    },
    {
      "endpoint": "/api/orders",
      "method": "GET",
      "samples": 0,
      "successSamples": 0,
      "errors": 25,
      "statusCounts": {},
      "p50": null,
      "p95": null,
      "p99": null,
      "successP50": null,
      "successP95": null,
      "successP99": null,
      "reachable": false,
      "meaningful": false,
      "authOnlyStatuses": false,
      "disallowedStatuses": [],
      "allowStatuses": [
        "200"
      ],
      "successStatuses": [
        "200"
      ]
    },
    {
      "endpoint": "/api/admin/reports",
      "method": "GET",
      "samples": 0,
      "successSamples": 0,
      "errors": 25,
      "statusCounts": {},
      "p50": null,
      "p95": null,
      "p99": null,
      "successP50": null,
      "successP95": null,
      "successP99": null,
      "reachable": false,
      "meaningful": false,
      "authOnlyStatuses": false,
      "disallowedStatuses": [],
      "allowStatuses": [
        "200"
      ],
      "successStatuses": [
        "200"
      ]
    }
  ]
}
```
