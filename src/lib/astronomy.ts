// ===== 天文计算引擎 =====
// 从 Stellara 1.0 复用，适配 2.0 类型
import Astronomy, {
  Body, Observer,
  Equator, Horizon, Illumination, AngleFromSun,
  SearchRiseSet, SearchAltitude, SearchHourAngle
} from 'astronomy-engine';
import type { GeoCoord, CelestialObject, CelestialPosition, MoonPhaseInfo, SunInfo } from '../types';

function makeObserver(loc: GeoCoord): Observer {
  return new Observer(loc.lat, loc.lon, 0);
}

function azimuthToDirection(az: number): string {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const idx = Math.round(((az % 360) / 45)) % 8;
  return dirs[idx];
}

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

const planetMap: Record<string, Body> = {
  mercury: Body.Mercury, venus: Body.Venus, mars: Body.Mars,
  jupiter: Body.Jupiter, saturn: Body.Saturn
};

export function computePosition(obj: CelestialObject, loc: GeoCoord, date: Date): CelestialPosition {
  const observer = makeObserver(loc);
  let azimuth = 0, altitude = 0, bestTime = '—', transitTime = '—';

  if (obj.type === 'planet') {
    const body = planetMap[obj.id];
    if (body) {
      const eq = Equator(body, date, observer, true, true);
      const hor = Horizon(date, observer, eq.ra, eq.dec, 'normal');
      azimuth = hor.azimuth; altitude = hor.altitude;
      try { const t = SearchHourAngle(body, observer, 0, date, 1); if (t) { transitTime = formatTime(t.time.date); bestTime = transitTime; } } catch {}
    }
  } else if (obj.type === 'moon') {
    const eq = Equator(Body.Moon, date, observer, true, true);
    const hor = Horizon(date, observer, eq.ra, eq.dec, 'normal');
    azimuth = hor.azimuth; altitude = hor.altitude;
    try { const t = SearchHourAngle(Body.Moon, observer, 0, date, 1); if (t) { transitTime = formatTime(t.time.date); bestTime = transitTime; } } catch {}
  } else {
    const hor = Horizon(date, observer, obj.ra, obj.dec, 'normal');
    azimuth = hor.azimuth; altitude = hor.altitude;
    bestTime = altitude > 30 ? '全夜可见' : '低空观测';
  }

  return { object: obj, azimuth: Math.round(azimuth), altitude: Math.round(altitude * 10) / 10,
    magnitude: obj.magnitude, visible: altitude > 0, bestTime, transitTime, directionText: azimuthToDirection(azimuth) };
}

export function computeMoonPhase(date: Date, loc: GeoCoord): MoonPhaseInfo {
  const observer = makeObserver(loc);
  const illum = Illumination(Body.Moon, date);
  const illumination = illum.phase_fraction;
  const sunElongDeg = AngleFromSun(Body.Moon, date);

  let phaseName = '新月';
  if (sunElongDeg < 22.5 || sunElongDeg >= 337.5) phaseName = '新月';
  else if (sunElongDeg < 67.5) phaseName = '蛾眉月';
  else if (sunElongDeg < 112.5) phaseName = '上弦月';
  else if (sunElongDeg < 157.5) phaseName = '盈凸月';
  else if (sunElongDeg < 202.5) phaseName = '满月';
  else if (sunElongDeg < 247.5) phaseName = '亏凸月';
  else if (sunElongDeg < 292.5) phaseName = '下弦月';
  else phaseName = '残月';

  const eq = Equator(Body.Moon, date, observer, true, true);
  const hor = Horizon(date, observer, eq.ra, eq.dec, 'normal');
  let riseTime = '—', setTime = '—';
  try { const r = SearchRiseSet(Body.Moon, observer, 1, date, 1); if (r) riseTime = formatTime(r.date); } catch {}
  try { const s = SearchRiseSet(Body.Moon, observer, -1, date, 1); if (s) setTime = formatTime(s.date); } catch {}

  return { phase: illumination, phaseName, illumination: Math.round(illumination * 100) / 100,
    altitude: Math.round(hor.altitude * 10) / 10, azimuth: Math.round(hor.azimuth), riseTime, setTime };
}

export function computeSunInfo(date: Date, loc: GeoCoord): SunInfo {
  const observer = makeObserver(loc);
  let sunrise = '—', sunset = '—', astroDawn = '—', astroDusk = '—';

  try { const r = SearchRiseSet(Body.Sun, observer, 1, date, 1); if (r) sunrise = formatTime(r.date); } catch {}
  try { const s = SearchRiseSet(Body.Sun, observer, -1, date, 1); if (s) sunset = formatTime(s.date); } catch {}
  try { const d = SearchAltitude(Body.Sun, observer, -1, date, 1, -18); if (d) astroDusk = formatTime(d.date); } catch {}
  try { const d = SearchAltitude(Body.Sun, observer, 1, date, 1, -18); if (d) astroDawn = formatTime(d.date); } catch {}

  const eq = Equator(Body.Sun, date, observer, true, true);
  const hor = Horizon(date, observer, eq.ra, eq.dec, 'normal');

  return { sunrise, sunset, astronomicalDawn: astroDawn, astronomicalDusk: astroDusk, altitude: Math.round(hor.altitude * 10) / 10 };
}

export function computeTonightRecommendations(catalog: CelestialObject[], loc: GeoCoord, date: Date, maxCount = 5): CelestialPosition[] {
  return catalog.map(obj => computePosition(obj, loc, date))
    .filter(p => p.visible && p.altitude > 10)
    .map(p => ({ ...p, _score: p.altitude - p.magnitude * 3 }))
    .sort((a, b) => (b as any)._score - (a as any)._score)
    .slice(0, maxCount)
    .map(({ ...p }) => { delete (p as any)._score; return p; });
}

/** 按方位分组天体（Sites核心：哪个方向有什么） */
export function groupByDirection(positions: CelestialPosition[]): Map<string, CelestialPosition[]> {
  const dirs = new Map<string, CelestialPosition[]>();
  const directionNames = ['N','NE','E','SE','S','SW','W','NW'];
  directionNames.forEach(d => dirs.set(d, []));

  for (const pos of positions) {
    if (!pos.visible || pos.altitude < 0) continue;
    const idx = Math.round(((pos.azimuth % 360) / 45)) % 8;
    const key = directionNames[idx];
    dirs.get(key)?.push(pos);
  }
  return dirs;
}
