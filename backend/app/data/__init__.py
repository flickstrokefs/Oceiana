"""
app.data — Real data fetcher layer for Oceiana.

Each sub-module fetches from a specific authoritative source,
caches results to disk with a manifest JSON, and raises
DataNotAvailableError when offline and no cache exists.
No synthetic data is ever returned by this package.
"""
