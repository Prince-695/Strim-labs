# STRIM Labs Client SDKs

Lightweight runtime telemetry and API discovery SDKs for Node.js, Python, and Go applications.

## Packages

| Package | Language | Ecosystem | Directory | Registry Link |
| :--- | :--- | :--- | :--- | :--- |
| `@strim-labs/node` | TypeScript / Node.js | npm | [`sdk/node`](./node) | [npmjs.com/package/@strim-labs/node](https://www.npmjs.com/package/@strim-labs/node) |
| `strim-labs` | Python | PyPI | [`sdk/python`](./python) | [pypi.org/project/strim-labs](https://pypi.org/project/strim-labs/) |
| `github.com/Prince-695/strim/sdk/go` | Go | Go Module | [`sdk/go`](./go) | [pkg.go.dev/github.com/Prince-695/strim/sdk/go](https://pkg.go.dev/github.com/Prince-695/strim/sdk/go) |

---

## Automated Publishing Workflow

A unified GitHub Actions workflow ([`.github/workflows/publish-sdks.yml`](../.github/workflows/publish-sdks.yml)) triggers on pushes to `main` when files under `sdk/**` change, or via manual dispatch.

### Required Repository Secrets

| Secret Name | Target | Purpose / Requirements |
| :--- | :--- | :--- |
| `NPM_TOKEN` | Node.js (`npm publish`) | **Must have 2FA bypass enabled** (or npm account 2FA configured to "Authorization only"). Standard tokens without 2FA bypass fail with `EOTP` in headless CI runners. |
| `PYPI_API_TOKEN` | Python (`twine upload`) | PyPI API token starting with `pypi-...` with write permissions to upload releases. |
| `GITHUB_TOKEN` | Go (`git tag`) | Built-in GitHub Actions token with `contents: write` permission to create semver tags (e.g. `sdk/go/v0.1.0`). |

### Setting Up `NPM_TOKEN`

1. On [npmjs.com](https://www.npmjs.com), navigate to **Access Tokens** &rarr; **Generate New Token**.
2. Select **Granular Access Token**.
3. Set **Permissions** to **Read and write (publish and stage)** for `@strim-labs`.
4. Ensure **"Bypass two-factor authentication"** is checked (or configure account-level 2FA to "Authorization only").
5. In your GitHub repository, go to **Settings** &rarr; **Secrets and variables** &rarr; **Actions** and add `NPM_TOKEN`.
