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

## CI/CD Publishing & npm Token Setup

Automated publishing is handled by GitHub Actions (`.github/workflows/publish-sdks.yml`) upon pushes to `main` with changes under `sdk/**`.

### Secret: `NPM_TOKEN`

The repository secret `NPM_TOKEN` must be configured with an npm token that has **Two-Factor Authentication (2FA) bypass enabled**:

1. **Token Generation on [npmjs.com](https://www.npmjs.com)**:
   - Navigate to **Profile** &rarr; **Access Tokens** &rarr; **Generate New Token**.
   - **Type**: Granular Access Token.
   - **Package permissions**: Read and write (publish and stage).
   - **Package scope**: Selected packages/scopes including `@strim-labs`.
   - **2FA Requirement**: Check **"Bypass two-factor authentication"** (or configure account-level 2FA mode to "Authorization only").
2. **GitHub Actions Secret Configuration**:
   - In GitHub, open **Settings** &rarr; **Secrets and variables** &rarr; **Actions**.
   - Create or update the secret named **`NPM_TOKEN`** with the token value.

> **Important**: Standard tokens without 2FA bypass cause headless CI runners to fail with `npm error code EOTP` ("This operation requires a one-time password from your authenticator") because CI environments cannot interactively supply one-time passwords.

