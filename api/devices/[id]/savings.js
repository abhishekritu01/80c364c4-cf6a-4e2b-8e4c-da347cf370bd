import { getData } from '../../data-loader.js';
import dayjs from 'dayjs';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = await getData();
    // Extract ID from URL path: /api/devices/:id/savings
    // Vercel makes path params available, but we'll parse from URL to be safe
    const urlPath = req.url || '';
    const match = urlPath.match(/\/devices\/(\d+)\/savings/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid device id in path' });
    }
    const id = Number(match[1]);
    
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

    res.status(200).json({
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
  } catch (error) {
    console.error('Error fetching savings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

