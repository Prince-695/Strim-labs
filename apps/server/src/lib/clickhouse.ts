/** ClickHouse analytics sink. Falls back to no-op if CLICKHOUSE_URL is unset. */

export async function insertRequestAggregates(rows: Record<string, unknown>[]): Promise<void> {
  const url = process.env.CLICKHOUSE_URL;
  if (!url || rows.length === 0) return;
  const database = process.env.CLICKHOUSE_DATABASE ?? "strim";
  const body = rows
    .map((r) => JSON.stringify({ ...r, _database: database }))
    .join("\n");
  try {
    await fetch(`${url}/?query=INSERT+INTO+${database}.request_aggregates+FORMAT+JSONEachRow`, {
      method: "POST",
      body,
    });
  } catch {
    // analytics is non-authoritative
  }
}
