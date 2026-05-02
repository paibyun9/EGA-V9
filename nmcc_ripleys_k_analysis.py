import pandas as pd
import numpy as np
from pathlib import Path
from scipy.spatial.distance import pdist, squareform

CSV_PATH = Path.home() / "data.csv"

DISTANCES_KM = [10, 20, 30, 40, 50]
AREA = 4_500_000
SIMS = 999
SEED = 42

KA_TYPES = {"neolithic site", "stone circle", "neolithicsite", "stonecircle"}
KB_TYPES = {"dolmen", "menhir"}


def ripley_k(dist_matrix, r, area, n):
    count = np.sum(dist_matrix <= r) - n
    return (area / (n * (n - 1))) * count


def l_function(k, r):
    return np.sqrt(k / np.pi) - r


def csr_simulation(coords, r):
    rng = np.random.default_rng(SEED)
    n = len(coords)

    # bounding box
    xmin, ymin = coords.min(axis=0)
    xmax, ymax = coords.max(axis=0)

    sims = []

    for _ in range(SIMS):
        rand = np.column_stack([
            rng.uniform(xmin, xmax, n),
            rng.uniform(ymin, ymax, n)
        ])
        d = squareform(pdist(rand)) / 1000.0
        sims.append(np.sum(d <= r) - n)

    return np.array(sims)


def compute_group(df, types):
    g = df[
        (df["Used_in_analysis"] == "yes") &
        (df["Structure Type"].isin(types))
    ].copy()

    g = g.dropna(subset=["UTM Easting", "UTM Northing"])

    coords = g[["UTM Easting", "UTM Northing"]].to_numpy()
    dist_km = squareform(pdist(coords)) / 1000.0
    n = len(coords)

    results = {}

    for r in DISTANCES_KM:
        k_obs = ripley_k(dist_km, r, AREA, n)
        k_exp = np.pi * r * r
        l_val = l_function(k_obs, r)

        sims = csr_simulation(coords, r)
        p = np.mean(sims >= (np.sum(dist_km <= r) - n))

        results[r] = (k_obs, k_exp, l_val, p)

    return results, n


def main():
    df = pd.read_csv(CSV_PATH)
    df.columns = df.columns.str.strip()

    df["Structure Type"] = df["Structure Type"].astype(str).str.strip().str.lower()
    df["Used_in_analysis"] = df["Used_in_analysis"].astype(str).str.strip().str.lower()

    df["UTM Easting"] = pd.to_numeric(df["UTM Easting"], errors="coerce")
    df["UTM Northing"] = pd.to_numeric(df["UTM Northing"], errors="coerce")

    ka, n_ka = compute_group(df, KA_TYPES)
    kb, n_kb = compute_group(df, KB_TYPES)

    print(f"K-A sites: {n_ka} | K-B sites: {n_kb}")
    print()
    print("Dist | K_obs(K-A) | L(K-A) | p | K_obs(K-B) | L(K-B) | p")
    print("-" * 75)

    for r in DISTANCES_KM:
        ka_obs, _, ka_l, ka_p = ka[r]
        kb_obs, _, kb_l, kb_p = kb[r]

        print(f"{r:4d} | {ka_obs:10.1f} | {ka_l:7.2f} | {ka_p:5.4f} | "
              f"{kb_obs:10.1f} | {kb_l:7.2f} | {kb_p:5.4f}")


if __name__ == "__main__":
    main()
