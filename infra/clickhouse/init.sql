CREATE DATABASE IF NOT EXISTS strim;

CREATE TABLE IF NOT EXISTS strim.request_aggregates (
    organization_id String,
    environment_id String,
    service String,
    endpoint String,
    method LowCardinality(String),
    status_code UInt16,
    duration_ms Float32,
    cache_hit UInt8,
    bytes_in UInt32,
    bytes_out UInt32,
    timestamp DateTime64(3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (organization_id, environment_id, service, toUnixTimestamp64Milli(timestamp));
