import json
from pathlib import Path
import pandas as pd

input_path = Path("benchmarks/results/runtime-verification-cost-results.json")
output_csv = Path("benchmarks/results/runtime-verification-cost-table.csv")
output_md = Path("benchmarks/results/runtime-verification-cost-table.md")

data = json.loads(input_path.read_text())

rows = []
for r in data:
    value = r["measurement"]

    if value is None:
        value = "Not measured"
    elif isinstance(value, float):
        value = f"{value:.6f}"
    rows.append({
        "Metric": r["metric"],
        "Measurement": value
    })

df = pd.DataFrame(rows)
df.to_csv(output_csv, index=False)
output_md.write_text(df.to_markdown(index=False))

print(df.to_markdown(index=False))
print(f"\nSaved: {output_csv}")
print(f"Saved: {output_md}")
