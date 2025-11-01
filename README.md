# Ampd Device Savings API

Simple Node.js API (Express) that serves device savings time-series backed by CSV data.

## Requirements
- Node.js 18.19.0 (see `.nvmrc`)
- Runs on macOS/Linux/Windows. Tested with CSVs in `data/`.

## Install
```bash
npm install
```

## Run
```bash
npm start
# Server listening on http://localhost:3000
```

Open UI: `http://localhost:3000/`

## API
- `GET /health` → `{ status: "ok" }`
- `GET /devices` → `{ devices: [{ id, name, timezone }] }`
- `GET /devices/:id/savings?start=ISO&end=ISO`
  - Enforces max 1-day range
  - Returns
    ```json
    {
      "device": { "id": 1, "name": "...", "timezone": "..." },
      "start": "2023-01-01T00:00:00.000Z",
      "end": "2023-01-01T23:59:59.999Z",
      "points": 48,
      "summary": { "total_carbon_saved": 123.45, "total_fuel_saved": 678.9 },
      "data": [
        {
          "timestamp": "2023-01-01T00:00:00.000Z",
          "device_timestamp": "2023-01-01T02:00:00.000Z",
          "carbon_saved": 6.20,
          "fuel_saved": 6.27
        }
      ]
    }
    ```

### cURL examples
```bash
curl http://localhost:3000/health
curl http://localhost:3000/devices
curl "http://localhost:3000/devices/1/savings?start=2023-01-01T00:00:00.000Z&end=2023-01-01T23:59:59.999Z"
```

## Notes
- CSV headers include a known typo `fueld_saved`; the API normalizes it to `fuel_saved`.
- Data is loaded into memory on startup for fast range queries.

