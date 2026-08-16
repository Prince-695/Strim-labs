"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/state";

export default function GenericList({
  title,
  path,
  keyName,
}: {
  title: string;
  path: string;
  keyName: string;
}) {
  const { token, orgId, environmentId } = useAppState();
  const [rows, setRows] = useState<unknown[]>([]);
  useEffect(() => {
    if (!token || !orgId) return;
    const q = environmentId ? `?environmentId=${environmentId}` : "";
    api<Record<string, unknown[]>>(`${path}${q}`, { token, orgId })
      .then((d) => setRows((d[keyName] as unknown[]) ?? []))
      .catch(() => setRows([]));
  }, [token, orgId, environmentId, path, keyName]);
  return (
    <div>
      <h1>{title}</h1>
      <div className="card">
        <pre className="muted" style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(rows.slice(0, 20), null, 2)}
        </pre>
      </div>
    </div>
  );
}
