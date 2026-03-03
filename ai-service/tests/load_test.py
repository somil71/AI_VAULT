import asyncio
import httpx
import time
import statistics
import sys

URL = "http://localhost:8000/analyze-phishing"

async def call_ai(client: httpx.AsyncClient, num: int):
    payload = {"text": f"Scam simulation message {num}: your account is locked!", "url": "http://scam-link.io"}
    try:
        start = time.perf_counter()
        resp = await client.post(URL, json=payload, timeout=30.0)
        latency = (time.perf_counter() - start) * 1000
        return {"status": resp.status_code, "latency": latency, "success": resp.json().get("status") == "success"}
    except Exception as e:
        return {"status": "error", "latency": 0, "success": False, "error": str(e)}

async def run_load_test(conc: int, total: int):
    print(f"Starting load test: {total} total requests, {conc} concurrency...")
    async with httpx.AsyncClient() as client:
        tasks = [call_ai(client, i) for i in range(total)]

        start_time = time.perf_counter()
        # Process in batches to simulate concurrency behavior strictly if needed, but gather handles concurrency natively
        results = await asyncio.gather(*tasks)
        total_time = time.perf_counter() - start_time

    latencies = [r["latency"] for r in results if r["success"]]
    successes = len(latencies)
    fails = total - successes

    if latencies:
        p50 = statistics.median(latencies)
        p95 = statistics.quantiles(latencies, n=20)[18] if len(latencies) > 20 else max(latencies)
        print(f"\nResults:")
        print(f"  Total Duration: {total_time:.2f}s")
        print(f"  Success: {successes} | Failed: {fails}")
        print(f"  P50 Latency: {p50:.2f}ms")
        print(f"  P95 Latency: {p95:.2f}ms")
    else:
        print("All requests failed.")

if __name__ == "__main__":
    CONC = 20
    TOTAL = 100
    asyncio.run(run_load_test(CONC, TOTAL))
