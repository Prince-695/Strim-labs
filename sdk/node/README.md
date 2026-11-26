# @strim-labs/node

Zero-dependency Node.js telemetry and runtime API discovery middleware for STRIM Labs.

## Installation

```bash
npm install @strim-labs/node
```

## Usage

### Express
```javascript
import express from 'express';
import { strim } from '@strim-labs/node';

const app = express();

app.use(strim({
  apiKey: process.env.STRIM_API_KEY, // e.g. strim_live_xyz...
  service: 'api-service'
}));

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Alex' });
});

app.listen(3000);
```

## Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `apiKey` | `string` | *(Required)* | Project API key generated in STRIM Labs dashboard |
| `endpoint` | `string` | `https://api.strimlabs.com` | STRIM Labs backend ingestion base URL |
| `service` | `string` | `'api'` | Logical service name for grouping metrics |
| `batchSize` | `number` | `50` | Number of events buffered before flushing |
| `flushIntervalMs` | `number` | `2000` | Maximum time to wait before flushing events |
| `debug` | `boolean` | `false` | Enable console debug logs |
