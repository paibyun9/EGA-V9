import json
from pathlib import Path
import pandas as pd

input_path = Path("benchmarks/results/runtime-performance-results.json")
output_csv = Path("benchmarks/results/runtime-performance-table.csv")
output_md = Path("benchmarks/results/runtime-performance-table.md")

data = json.loads(input_path.read_text())

rows = []
for r in data:
    rows.append({
        "Metric": r["metric"],
        "P50 (ms)": round(r["p50_ms"], 6),
        "P90 (ms)": round(r["p90_ms"], 6),
        "P99 (ms)": round(r["p99_ms"], 6),
        "Mean (ms)": round(r["mean_ms"], 6),
        "Memory Overhead (MB)": round(r["memory_overhead_mb"], 6),
    })

df = pd.DataFrame(rows)
df.to_csv(output_csv, index=False)
output_md.write_text(df.to_markdown(index=False))

print(df.to_markdown(index=False))
print(f"\nSaved: {output_csv}")
print(f"Saved: {output_md}")
