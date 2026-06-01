import type { AppSettings } from '../settings/settingsTypes';

export interface LocationHint {
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface HolidayBrief {
  name: string;
  date: string;
  daysUntil: number;
  candlesTime: string | null;
  havdalahTime: string | null;
}

export interface WeatherBrief {
  cityLabel: string;
  morningTempC: number | null;
  noonTempC: number | null;
  currentTempC: number | null;
  description: string;
  source: 'open-meteo' | 'fallback';
  sunriseTime?: string | null;
  sunsetTime?: string | null;
  shabbatLabel?: 'שקיעה' | 'כניסת שבת' | 'צאת שבת' | null;
  shabbatTime?: string | null;
  shabbatSource?: 'hebcal' | 'open-meteo' | 'fallback';
  timezone?: string;
  latitude?: number;
  longitude?: number;
  upcomingHolidays?: HolidayBrief[];
}

const locationHints: Array<LocationHint & { terms: string[] }> = [
  { terms: ['תל אביב', 'tel aviv', 'tel-aviv', 'telaviv'], label: 'תל אביב', latitude: 32.0853, longitude: 34.7818, timezone: 'Asia/Jerusalem' },
  { terms: ['ירושלים', 'jerusalem'], label: 'ירושלים', latitude: 31.7683, longitude: 35.2137, timezone: 'Asia/Jerusalem' },
  { terms: ['חיפה', 'haifa'], label: 'חיפה', latitude: 32.7940, longitude: 34.9896, timezone: 'Asia/Jerusalem' },
  { terms: ['הרצליה', 'herzliya', 'herzeliya'], label: 'הרצליה', latitude: 32.1624, longitude: 34.8447, timezone: 'Asia/Jerusalem' },
  { terms: ['רמת גן', 'ramat gan'], label: 'רמת גן', latitude: 32.0684, longitude: 34.8248, timezone: 'Asia/Jerusalem' },
  { terms: ['בנגקוק', 'bangkok', 'krung thep'], label: 'בנגקוק', latitude: 13.7563, longitude: 100.5018, timezone: 'Asia/Bangkok' },
  { terms: ['לונדון', 'london'], label: 'לונדון', latitude: 51.5072, longitude: -0.1276, timezone: 'Europe/London' },
  { terms: ['ניו יורק', 'new york', 'nyc'], label: 'ניו יורק', latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York' },
];

function normalize(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function findLocation(settings: AppSettings | null): LocationHint {
  const candidates = [settings?.location.label, settings?.location.city, settings?.location.country].map(normalize).filter(Boolean);
  const hint = locationHints.find((entry) => candidates.some((candidate) => entry.terms.some((term) => candidate.includes(normalize(term)) || normalize(term).includes(candidate))));
  if (hint) return hint;

  const lat = settings?.location.latitude;
  const lon = settings?.location.longitude;
  if (typeof lat === 'number' && typeof lon === 'number') {
    return {
      label: settings?.location.label || settings?.location.city || 'המיקום שלך',
      latitude: lat,
      longitude: lon,
      timezone: settings?.location.timezone || 'auto',
    };
  }

  return locationHints[0];
}

function getTempForHour(times: string[], temps: number[], targetHour: number): number | null {
  const index = times.findIndex((time) => {
    const rawHour = time.split('T')[1]?.slice(0, 2);
    const hour = Number(rawHour);
    return Number.isFinite(hour) && hour === targetHour;
  });
  if (index >= 0 && typeof temps[index] === 'number') return Math.round(temps[index]);
  return null;
}

function describeWeatherCode(code: number | null | undefined): string {
  if (code == null) return '';
  if (code === 0) return 'שמיים בהירים';
  if ([1, 2].includes(code)) return 'בהיר חלקית';
  if (code === 3) return 'מעונן';
  if ([45, 48].includes(code)) return 'ערפל קל';
  if ([51, 53, 55, 56, 57].includes(code)) return 'טפטופים קלים';
  if ([61, 63, 65, 66, 67].includes(code)) return 'גשם';
  if ([71, 73, 75, 77].includes(code)) return 'שלג';
  if ([80, 81, 82].includes(code)) return 'ממטרים';
  if ([95, 96, 99].includes(code)) return 'סופות רעמים';
  return '';
}

function describeTemperature(noonTemp: number | null, codeDescription: string): string {
  const weatherDesc = codeDescription ? `${codeDescription}. ` : '';
  if (noonTemp == null) return weatherDesc.trim();
  if (noonTemp >= 34) return `${weatherDesc}חם מאוד.`;
  if (noonTemp >= 28) return `${weatherDesc}חם.`;
  if (noonTemp >= 22) return `${weatherDesc}נעים עד חמים.`;
  if (noonTemp >= 16) return `${weatherDesc}נעים.`;
  return `${weatherDesc}קריר.`;
}

function formatLocalTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const hour = value.split('T')[1]?.slice(0, 5);
    return hour || null;
  }
  return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function getDayKind(todayISO: string): 'friday' | 'saturday' | 'regular' {
  const day = new Date(`${todayISO}T12:00:00`).getDay();
  if (day === 5) return 'friday';
  if (day === 6) return 'saturday';
  return 'regular';
}

async function fetchUpcomingHolidays(location: LocationHint, todayISO: string): Promise<HolidayBrief[]> {
  const today = new Date(`${todayISO}T12:00:00`);
  const sevenDaysLater = new Date(today.getTime() + 8 * 864e5);

  const fetchMonthItems = async (year: number, month: number): Promise<Array<{ category?: string; date?: string; title?: string; hebrew?: string; subcat?: string }>> => {
    const params = new URLSearchParams({
      v: '1', cfg: 'json', maj: 'on', min: 'off', mod: 'on', nx: 'off',
      year: String(year), month: String(month),
      c: 'on', geo: 'pos',
      latitude: String(location.latitude), longitude: String(location.longitude),
      tzid: location.timezone || 'Asia/Jerusalem',
      b: '18', m: '50', s: 'on', leyning: 'off',
    });
    try {
      const res = await fetch(`https://www.hebcal.com/hebcal?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json() as { items?: Array<{ category?: string; date?: string; title?: string; hebrew?: string; subcat?: string }> };
      return data.items ?? [];
    } catch {
      return [];
    }
  };

  try {
    const curYear = today.getFullYear();
    const curMonth = today.getMonth() + 1;
    let items = await fetchMonthItems(curYear, curMonth);

    // If we're within 7 days of month end, also fetch next month
    const daysInMonth = new Date(curYear, curMonth, 0).getDate();
    const dayOfMonth = today.getDate();
    if (daysInMonth - dayOfMonth < 7) {
      const nextMonth = curMonth === 12 ? 1 : curMonth + 1;
      const nextYear = curMonth === 12 ? curYear + 1 : curYear;
      const nextItems = await fetchMonthItems(nextYear, nextMonth);
      items = [...items, ...nextItems];
    }

    const holidays: HolidayBrief[] = [];

    for (const item of items) {
      if (item.category !== 'holiday') continue;
      if (!item.date) continue;
      // Exclude minor holidays (Rosh Chodesh, etc.) — keep majors and special Shabbatot
      if (item.subcat && !['major', 'modern'].includes(item.subcat)) continue;

      const hDate = new Date(item.date);
      if (hDate < today || hDate > sevenDaysLater) continue;

      const dateISO = hDate.toISOString().slice(0, 10);

      // Find candles item closest before this holiday (computed first — used for daysUntil)
      const candlesItem = items
        .filter((i) => i.category === 'candles' && i.date)
        .map((i) => ({ ...i, d: new Date(i.date!) }))
        .filter((i) => {
          const diff = (hDate.getTime() - i.d.getTime()) / 864e5;
          return diff >= 0 && diff < 1.5;
        })
        .sort((a, b) => b.d.getTime() - a.d.getTime())[0];

      // Find havdalah item closest after this holiday
      const havdalahItem = items
        .filter((i) => i.category === 'havdalah' && i.date)
        .map((i) => ({ ...i, d: new Date(i.date!) }))
        .filter((i) => {
          const diff = (i.d.getTime() - hDate.getTime()) / 864e5;
          return diff >= 0 && diff < 2.5;
        })
        .sort((a, b) => a.d.getTime() - b.d.getTime())[0];

      // Use candles date as the effective start (Jewish holidays begin the evening before
      // the calendar date, so candles on May 21 means the holiday "starts today" even
      // though Hebcal's calendar date is May 22)
      const candlesDateISO = candlesItem?.date ? candlesItem.date.slice(0, 10) : null;
      const effectiveDate = candlesDateISO
        ? new Date(`${candlesDateISO}T12:00:00`)
        : hDate;
      const daysUntil = Math.max(0, Math.round((effectiveDate.getTime() - today.getTime()) / 864e5));

      // Dedupe by date (multi-day holidays appear multiple times)
      if (holidays.some((h) => h.date === dateISO)) continue;

      holidays.push({
        name: item.hebrew || item.title || 'חג',
        date: dateISO,
        daysUntil,
        candlesTime: candlesItem ? formatLocalTime(candlesItem.date!) : null,
        havdalahTime: havdalahItem ? formatLocalTime(havdalahItem.date!) : null,
      });
    }

    return holidays.sort((a, b) => a.daysUntil - b.daysUntil);
  } catch {
    return [];
  }
}

async function fetchHebcalShabbatTime(location: LocationHint, todayISO: string): Promise<{ label: 'כניסת שבת' | 'צאת שבת'; time: string } | null> {
  const dayKind = getDayKind(todayISO);
  if (dayKind === 'regular') return null;
  const date = new Date(`${todayISO}T12:00:00`);
  const params = new URLSearchParams({
    cfg: 'json',
    geo: 'pos',
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    M: 'on',
    b: '18',
    leyning: 'off',
    gy: String(date.getFullYear()),
    gm: String(date.getMonth() + 1),
    gd: String(date.getDate()),
  });

  try {
    const response = await fetch(`https://www.hebcal.com/shabbat?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const json = await response.json() as { items?: Array<{ category?: string; date?: string; title?: string }> };
    const category = dayKind === 'friday' ? 'candles' : 'havdalah';
    const item = (json.items ?? []).find((entry) => entry.category === category);
    const time = formatLocalTime(item?.date);
    if (!time) return null;
    return { label: dayKind === 'friday' ? 'כניסת שבת' : 'צאת שבת', time };
  } catch {
    return null;
  }
}

export async function fetchWeatherBrief(settings: AppSettings | null, todayISO: string): Promise<WeatherBrief> {
  const location = findLocation(settings);
  const fallback: WeatherBrief = {
    cityLabel: location.label,
    morningTempC: null,
    noonTempC: null,
    currentTempC: null,
    description: 'מזג האוויר החי לא נטען כרגע. תבדוק לפני יציאה.',
    source: 'fallback',
    sunriseTime: null,
    sunsetTime: null,
    shabbatLabel: getDayKind(todayISO) === 'friday' ? 'כניסת שבת' : getDayKind(todayISO) === 'saturday' ? 'צאת שבת' : 'שקיעה',
    shabbatTime: null,
    shabbatSource: 'fallback',
    timezone: location.timezone,
    latitude: location.latitude,
    longitude: location.longitude,
  };

  try {
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      hourly: 'temperature_2m',
      daily: 'sunrise,sunset',
      current: 'temperature_2m,weather_code',
      timezone: location.timezone || 'auto',
      forecast_days: '1',
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) return fallback;
    const json = await response.json() as {
      current?: { temperature_2m?: number; weather_code?: number };
      hourly?: { time?: string[]; temperature_2m?: number[] };
      daily?: { sunrise?: string[]; sunset?: string[] };
    };
    const times = json.hourly?.time ?? [];
    const temps = json.hourly?.temperature_2m ?? [];
    const todayTimes = times.map((time, index) => ({ time, temp: temps[index] })).filter(({ time }) => time.startsWith(todayISO));
    const filteredTimes = todayTimes.map((entry) => entry.time);
    const filteredTemps = todayTimes.map((entry) => entry.temp);
    const morningTempC = getTempForHour(filteredTimes, filteredTemps, 8) ?? getTempForHour(filteredTimes, filteredTemps, 9);
    const noonTempC = getTempForHour(filteredTimes, filteredTemps, 12) ?? getTempForHour(filteredTimes, filteredTemps, 13);
    const currentTempC = typeof json.current?.temperature_2m === 'number' ? Math.round(json.current.temperature_2m) : null;
    const sunriseTime = formatLocalTime(json.daily?.sunrise?.[0]);
    const sunsetTime = formatLocalTime(json.daily?.sunset?.[0]);
    const codeDescription = describeWeatherCode(json.current?.weather_code);
    const [shabbat, upcomingHolidays] = await Promise.all([
      fetchHebcalShabbatTime(location, todayISO),
      fetchUpcomingHolidays(location, todayISO),
    ]);
    const dayKind = getDayKind(todayISO);

    return {
      cityLabel: location.label,
      morningTempC,
      noonTempC,
      currentTempC,
      description: describeTemperature(noonTempC, codeDescription),
      source: 'open-meteo',
      sunriseTime,
      sunsetTime,
      shabbatLabel: shabbat?.label ?? (dayKind === 'friday' ? 'כניסת שבת' : dayKind === 'saturday' ? 'צאת שבת' : 'שקיעה'),
      shabbatTime: shabbat?.time ?? sunsetTime,
      shabbatSource: shabbat ? 'hebcal' : 'open-meteo',
      timezone: location.timezone,
      latitude: location.latitude,
      longitude: location.longitude,
      upcomingHolidays,
    };
  } catch {
    return fallback;
  }
}
