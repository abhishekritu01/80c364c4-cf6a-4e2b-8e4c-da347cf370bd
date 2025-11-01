import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DEVICES_CSV = path.join(DATA_DIR, 'devices.csv');
const SAVINGS_CSV = path.join(DATA_DIR, 'device-saving.csv');

/**
 * In-memory cache (persists across function invocations in same environment)
 */
let cache = null;

async function loadDevices() {
  const csv = await readFile(DEVICES_CSV, 'utf8');
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return records.map((r) => ({
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

  const savingsByDeviceId = new Map();

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
    if (!savingsByDeviceId.has(deviceId)) {
      savingsByDeviceId.set(deviceId, []);
    }
    savingsByDeviceId.get(deviceId).push(record);
  }

  // Sort each device series by timestamp
  for (const series of savingsByDeviceId.values()) {
    series.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  }

  return savingsByDeviceId;
}

export async function getData() {
  if (cache) {
    return cache;
  }

  const [devices, savingsByDeviceId] = await Promise.all([
    loadDevices(),
    loadSavings(),
  ]);

  cache = {
    devices,
    savingsByDeviceId,
  };

  return cache;
}

