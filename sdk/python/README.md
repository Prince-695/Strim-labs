# strim-labs (Python SDK)

Zero-dependency Python telemetry and runtime API discovery middleware for STRIM Labs.

## Installation

```bash
pip install strim-labs
```

## Usage

### FastAPI
```python
from fastapi import FastAPI
from strim import StrimFastAPIMiddleware

app = FastAPI()

app.add_middleware(
    StrimFastAPIMiddleware,
    api_key="strim_live_xyz123",
    service="catalog-api",
)

@app.get("/items/{item_id}")
def read_item(item_id: int):
    return {"item_id": item_id, "status": "active"}
```

### Flask
```python
from flask import Flask
from strim import StrimFlask

app = Flask(__name__)
StrimFlask(app, api_key="strim_live_xyz123", service="auth-service")

@app.route("/login", methods=["POST"])
def login():
    return {"token": "sample"}
```
