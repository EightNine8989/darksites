// ===== 定位服务 =====
// 从 Stellara 1.0 复用
import type { ObservationLocation } from '../types';

const STORAGE_KEY = 'ds_locations';
const CURRENT_KEY = 'ds_current_location';

const defaultLocations: ObservationLocation[] = [
  { id: 'bj-miyun', name: '北京·密云水库', lat: 40.63, lon: 117.0, bortle: 3 },
  { id: 'bj-huairou', name: '北京·怀柔喇叭沟门', lat: 40.92, lon: 116.48, bortle: 2 },
];

function coordToName(lat: number, lon: number): string {
  const provinces: [number, number, number, number, string][] = [
    [39.4,41.1,115.4,117.5,'北京'],[30.7,35.1,118.4,122.0,'上海'],[23.1,23.1,113.3,113.3,'广州'],
    [30.6,30.6,104.1,104.1,'成都'],[34.3,34.3,108.9,108.9,'西安'],[30.3,30.3,120.2,120.2,'杭州'],
  ];
  for (const [minLat, maxLat, minLon, maxLon, name] of provinces) {
    if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) return `${name}·${lat.toFixed(2)},${lon.toFixed(2)}`;
  }
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

function estimateBortle(lat: number, lon: number): number {
  const cities: [number, number, number][] = [[39.9,116.4,8],[31.2,121.5,8],[23.1,113.3,8],[22.5,114.1,8],[30.6,104.1,7]];
  let minDist = Infinity, bortle = 5;
  for (const [cLat, cLon, cB] of cities) {
    const d = Math.sqrt((lat-cLat)**2 + (lon-cLon)**2);
    if (d < minDist) { minDist = d; bortle = cB; }
  }
  if (minDist > 3) bortle = Math.max(2, bortle - 5);
  else if (minDist > 1.5) bortle = Math.max(3, bortle - 3);
  else if (minDist > 0.5) bortle = Math.max(4, bortle - 2);
  return bortle;
}

export function getCurrentPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('无GPS')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4) }),
      err => reject(new Error('定位失败')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  });
}

export async function getGPSLocation(): Promise<ObservationLocation> {
  const { lat, lon } = await getCurrentPosition();
  return { id: 'gps', name: coordToName(lat, lon), lat, lon, bortle: estimateBortle(lat, lon), isCurrentGPS: true };
}

export function getSavedLocations(): ObservationLocation[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch {}
  return [...defaultLocations];
}

export function setCurrentLocation(loc: ObservationLocation): void {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(loc));
}

export function getCurrentLocation(): ObservationLocation {
  try { const raw = localStorage.getItem(CURRENT_KEY); if (raw) return JSON.parse(raw); } catch {}
  return defaultLocations[0];
}
