import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import dayjs from 'dayjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DEVICES_CSV = path.join(DATA_DIR, 'devices.csv');
const SAVINGS_CSV = path.join(DATA_DIR, 'device-saving.csv');

/**
 * In-memory store
 */
const db = {
  devices: [],
  savingsByDeviceId: new Map(),
};

async function loadDevices() {
  const csv = await readFile(DEVICES_CSV, 'utf8');
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  db.devices = records.map((r) => ({
    id: Number(r.id),
    name: r.name,
    timezone: r.timezone,
  }));
}

async function loadSavings() {
  const csv = await readFile(SAVINGS_CSV, 'utf8');
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // Normalize headers including known typo: fueld_saved -> fuel_saved
  for (const row of records) {
    const deviceId = Number(row.device_id);
    const record = {
      deviceId,
      timestamp: row.timestamp, // UTC ISO string
      deviceTimestamp: row.device_timestamp, // device-local ISO string
      carbon_saved: Number(row.carbon_saved),
      fuel_saved: Number(row.fueld_saved ?? row.fuel_saved ?? 0),
    };
    if (!db.savingsByDeviceId.has(deviceId)) {
      db.savingsByDeviceId.set(deviceId, []);
    }
    db.savingsByDeviceId.get(deviceId).push(record);
  }

  // Sort each device series by timestamp
  for (const series of db.savingsByDeviceId.values()) {
    series.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  }
}

async function bootstrap() {
  await loadDevices();
  await loadSavings();
}

function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/devices', (req, res) => {
    res.json({ devices: db.devices });
  });

  app.get('/devices/:id/savings', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid device id' });
    }
    const device = db.devices.find((d) => d.id === id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const start = req.query.start ? dayjs(req.query.start) : null;
    const end = req.query.end ? dayjs(req.query.end) : null;

    if (!start || !end || !start.isValid() || !end.isValid()) {
      return res.status(400).json({
        error: 'start and end query params (ISO-8601) are required',
        example: `/devices/${id}/savings?start=2023-01-01T00:00:00.000Z&end=2023-01-01T23:59:59.999Z`,
      });
    }

    const durationMs = end.valueOf() - start.valueOf();
    if (durationMs < 0) {
      return res.status(400).json({ error: 'end must be after start' });
    }
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (durationMs > oneDayMs) {
      return res.status(400).json({ error: 'Maximum allowed range is 1 day' });
    }

    const series = db.savingsByDeviceId.get(id) || [];
    const data = series.filter((r) => {
      const t = dayjs(r.timestamp).valueOf();
      return t >= start.valueOf() && t <= end.valueOf();
    });

    const summary = data.reduce(
      (acc, r) => {
        acc.total_carbon_saved += r.carbon_saved;
        acc.total_fuel_saved += r.fuel_saved;
        return acc;
      },
      { total_carbon_saved: 0, total_fuel_saved: 0 }
    );

    res.json({
      device,
      start: start.toISOString(),
      end: end.toISOString(),
      points: data.length,
      summary,
      data: data.map((r) => ({
        timestamp: r.timestamp,
        device_timestamp: r.deviceTimestamp,
        carbon_saved: r.carbon_saved,
        fuel_saved: r.fuel_saved,
      })),
    });
  });

  // Simple static UI
  app.use('/', express.static(path.resolve(__dirname, 'web')));

  return app;
}

const PORT = process.env.PORT || 3000;

await bootstrap();
const app = createServer();
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});


