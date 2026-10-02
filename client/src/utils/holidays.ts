function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function getItalianHoliday(date: Date): { isHoliday: boolean; name?: string } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed
  const day = date.getDate();

  // Fixed holidays
  if (month === 1 && day === 1) return { isHoliday: true, name: 'Capodanno' };
  if (month === 1 && day === 6) return { isHoliday: true, name: 'Epifania' };
  if (month === 4 && day === 25) return { isHoliday: true, name: 'Festa della Liberazione' };
  if (month === 5 && day === 1) return { isHoliday: true, name: 'Festa del Lavoro' };
  if (month === 6 && day === 2) return { isHoliday: true, name: 'Festa della Repubblica' };
  if (month === 8 && day === 15) return { isHoliday: true, name: 'Ferragosto' };
  if (month === 11 && day === 1) return { isHoliday: true, name: 'Tutti i Santi' };
  if (month === 12 && day === 8) return { isHoliday: true, name: 'Immacolata Concezione' };
  if (month === 12 && day === 25) return { isHoliday: true, name: 'Natale' };
  if (month === 12 && day === 26) return { isHoliday: true, name: 'Santo Stefano' };

  // Variable holidays (Easter and Easter Monday)
  const easter = getEasterDate(year);
  
  // Easter Monday
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  if (date.getMonth() === easter.getMonth() && date.getDate() === easter.getDate()) {
    return { isHoliday: true, name: 'Pasqua' };
  }
  if (date.getMonth() === easterMonday.getMonth() && date.getDate() === easterMonday.getDate()) {
    return { isHoliday: true, name: "Lunedì dell'Angelo (Pasquetta)" };
  }

  return { isHoliday: false };
}
