// ===== 天气服务 =====
// 从 Stellara 1.0 复用，适配 2.0 类型
import type { HourlyWeather, GeoCoord } from '../types';

export interface ScoreInput {
  cloudCover: number; moonAltitude: number; moonIllumination: number;
  sunAltitude: number; windSpeed: number; bortle: number; visibility: number;
}

export interface ScoreResult { score: number; reasons: string[]; }

export function computeHourlyScore(input: ScoreInput): ScoreResult {
  let score = 100;
  const reasons: string[] = [];
  if (input.sunAltitude > -18) return { score: 0, reasons: ['天空太亮'] };
  if (input.cloudCover > 90) return { score: 0, reasons: ['云量超90%'] };
  score -= (input.cloudCover / 10) * 8;
  if (input.cloudCover > 50) reasons.push(`云量${input.cloudCover}%`);
  else if (input.cloudCover > 20) reasons.push('少量云');
  if (input.moonAltitude > 0 && input.moonIllumination > 0.5) {
    score -= input.moonIllumination * input.moonAltitude * 0.3;
    if (input.moonIllumination > 0.8) reasons.push('月光干扰强');
  }
  if (input.windSpeed > 15) { score -= (input.windSpeed - 15) * 1.5; reasons.push('风速大'); }
  else if (input.windSpeed > 10) { score -= (input.windSpeed - 10); }
  if (input.bortle >= 7) { score -= (input.bortle - 6) * 6; reasons.push('光污染严重'); }
  else if (input.bortle >= 5) { score -= (input.bortle - 4) * 3; }
  if (input.visibility > 0 && input.visibility < 5) { score -= (5 - input.visibility) * 3; reasons.push('能见度低'); }
  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

export async function fetchHourlyWeather(location: GeoCoord): Promise<HourlyWeather[] | null> {
  const params = new URLSearchParams({
    latitude: location.lat.toString(), longitude: location.lon.toString(),
    hourly: 'cloud_cover,wind_speed_10m,visibility,temperature_2m,relative_humidity_2m',
    timezone: 'auto', wind_speed_unit: 'kmh', forecast_days: '3'
  });
  try {
    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    const h = data.hourly;
    if (!h?.time) return null;
    const now = Date.now();
    const result: HourlyWeather[] = [];
    for (let i = 0; i < h.time.length; i++) {
      const dt = new Date(h.time[i]);
      if (dt.getTime() < now - 3600_000) continue;
      result.push({ time: h.time[i], cloudCover: h.cloud_cover?.[i] ?? 0, temperature: h.temperature_2m?.[i] ?? 0,
        humidity: h.relative_humidity_2m?.[i] ?? 0, windSpeed: h.wind_speed_10m?.[i] ?? 0,
        visibility: h.visibility?.[i] != null ? Math.round(h.visibility[i] / 1000 * 10) / 10 : 20 });
    }
    return result.length > 0 ? result : null;
  } catch { return null; }
}

export function findBestWindow(hourlyScores: { time: Date; score: number }[]): { start: string; end: string; score: number } | null {
  const obs = hourlyScores.filter(h => h.score >= 40);
  if (!obs.length) return null;
  let bestIdx = 0, bestScore = 0;
  for (let i = 0; i < obs.length; i++) { if (obs[i].score > bestScore) { bestScore = obs[i].score; bestIdx = i; } }
  let startIdx = bestIdx;
  while (startIdx > 0 && obs[startIdx - 1].score >= 50) startIdx--;
  let endIdx = bestIdx;
  while (endIdx < obs.length - 1 && obs[endIdx + 1].score >= 50) endIdx++;
  const fmt = (d: Date) => `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  return { start: fmt(obs[startIdx].time), end: fmt(obs[endIdx].time), score: bestScore };
}
