// ===== Core Geography =====
export interface GeoCoord { lat: number; lon: number; }

// ===== Observation Context (shared across all pages) =====
export type AppLanguage = 'zh' | 'en';

export interface ObservationContext {
  location: ObservationLocation;
  date: Date;            // selected observation date
  startTime: string;     // "HH:MM" e.g. "22:00"
  planningMode: 'single' | 'weekend' | 'month';
  activeTarget: string;  // filter key: 'all' | 'milkyway' | 'meteor' | 'moon' | 'planets'
  equipment: EquipmentSet;
  language: AppLanguage;
}

// ===== Location =====
export interface ObservationLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  bortle: number;
  isCurrentGPS?: boolean;
}

// ===== Directional Sky (Sites core) =====
export interface DirectionSky {
  azimuth: number;        // 0-360
  name: string;           // N / NE / E / SE / S / SW / W / NW
  label: string;            // direction label (localized)
  score: number;          // 0-100 visibility score for this direction
  objects: DirectionObject[];
  horizonClear: boolean;  // terrain horizon clear?
}

export interface DirectionObject {
  id: string;
  name: string;
  type: CelestialCategory;
  altitude: number;       // current altitude in degrees
  bestTime: string;       // "HH:MM"
  magnitude: number;
  visible: boolean;
}

// ===== Celestial Objects =====
export type CelestialCategory = 'planet' | 'star' | 'deepSky' | 'moon' | 'meteor' | 'milkyway';

export interface CelestialObject {
  id: string;
  name: string;
  type: CelestialCategory;
  constellation?: string;
  magnitude: number;
  ra: number;  // hours
  dec: number; // degrees
  description?: string;
  equipment?: string[];
  difficulty?: 'easy' | 'moderate' | 'challenging';
}

export interface CelestialPosition {
  object: CelestialObject;
  azimuth: number;
  altitude: number;
  magnitude: number;
  visible: boolean;
  bestTime: string;
  transitTime?: string;
  directionText: string;
}

// ===== Moon & Sun =====
export interface MoonPhaseInfo {
  phase: number;
  phaseName: string;
  illumination: number;
  altitude: number;
  azimuth: number;
  riseTime?: string;
  setTime?: string;
}

export interface SunInfo {
  sunrise: string;
  sunset: string;
  astronomicalDusk: string;
  astronomicalDawn: string;
  altitude: number;
}

// ===== Weather =====
export interface HourlyWeather {
  time: string;
  cloudCover: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  visibility: number;
}

export interface HourlyScore {
  time: string;
  score: number;
  cloudCover: number;
  windSpeed: number;
  moonAltitude: number;
  moonIllumination: number;
  isDark: boolean;
  isObservable: boolean;
  reasons: string[];
}

// ===== Equipment =====
export type EquipmentType = 'naked_eye' | 'binoculars' | 'telescope' | 'camera' | 'phone';

export interface EquipmentItem {
  id: string;
  type: EquipmentType;
  label: string;
  // binoculars
  magnification?: number;
  apertureMm?: number;
  // telescope
  telescopeType?: 'refractor' | 'reflector' | 'sct' | 'smart';
  focalLengthMm?: number;
  // camera
  sensorType?: 'full_frame' | 'aps_c' | 'mft' | 'one_inch';
  lensFocalLengthMm?: number;
  maxAperture?: number;
  tracking?: 'none' | 'star_tracker' | 'equatorial';
  // phone
  phoneModel?: string;
}

export interface EquipmentSet {
  items: EquipmentItem[];
  primary: string;  // id of primary item
}

// ===== Dark Sites =====
export type SiteStatus = 'suggested' | 'community_verified' | 'official';

export interface DarkSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  bortle: number;
  elevation?: number;
  status: SiteStatus;
  distKm?: number;
  driveMin?: number;
  // facilities
  parking?: 'easy' | 'limited' | 'none' | 'unknown';
  toilet?: 'available' | 'none_seen' | 'unknown';
  nightAccess?: 'open' | 'restricted' | 'closed' | 'unknown';
  localLights?: 'none' | 'minor' | 'moderate' | 'severe' | 'unknown';
  // computed at runtime
  score?: number;
  weather?: { cloudCover: number; transparency: number };
  moonImpact?: string;
  bestWindow?: { start: string; end: string };
  suitableEquipment?: string[];
}

// ===== Contribution =====
export type ContributionStatus = 'pending' | 'accepted' | 'verified' | 'conflicted' | 'rejected';

export interface Contribution {
  id: string;
  siteId: string;
  userId?: string;
  fieldKey: string;
  value: string;
  visitType: 'onsite' | 'past_visit';
  evidence?: string[];
  locationProof?: boolean;
  submittedAt: string;
  reviewState: ContributionStatus;
  independentConfirmations: number;
}

// ===== Observation Records =====
export interface ObservationRecord {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  locationName: string;
  bortle: number;
  targets: ObservedTarget[];
  notes?: string;
  images?: string[];
  device?: string;
  weatherScore?: number;
  moonPhase?: string;
  createdAt: string;
}

export interface ObservedTarget {
  id: string;
  name: string;
  type: CelestialCategory;
  completedAt?: string;
  notes?: string;
}

// ===== Season Visibility =====
export type MonthVisibility = 'low' | 'mid' | 'high' | 'best';

export interface SeasonCurve {
  months: MonthVisibility[];  // 12 entries, index 0 = Jan
  bestMonths: string;        // e.g. "May–Aug"
}
