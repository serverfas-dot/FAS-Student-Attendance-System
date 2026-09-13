const ACADEMIC_YEAR = 2026;
const WEEKEND_DAYS = new Set([4, 5]);

const NON_SCHOOL_DATES = new Set([
  '2026-02-05', '2026-02-18', '2026-05-10',
  ...Array.from({ length: 14 }, (_, index) => `2026-03-${String(index + 9).padStart(2, '0')}`),
  ...Array.from({ length: 7 }, (_, index) => `2026-05-${String(index + 24).padStart(2, '0')}`),
  '2026-08-12', '2026-09-03', '2026-09-24', '2026-10-05',
  '2026-10-15', '2026-11-03', '2026-11-11', '2026-12-01',
]);

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isAcademicSchoolDay(value: string): boolean {
  if (value.slice(0, 4) !== String(ACADEMIC_YEAR) || NON_SCHOOL_DATES.has(value)) return false;

  const date = toDate(value);
  if (WEEKEND_DAYS.has(date.getDay())) return false;

  const firstTerm = value >= '2026-01-25' && value <= '2026-07-16';
  const secondTerm = value >= '2026-08-02' && value <= '2026-12-17';
  return firstTerm || secondTerm;
}

export function getAcademicSchoolDays(startDate: string, endDate: string): number {
  const start = toDate(startDate);
  const end = toDate(endDate);
  let count = 0;

  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    if (isAcademicSchoolDay(toKey(date))) count++;
  }

  return count;
}

export function getAcademicMonthSchoolDays(year: number, month: number): number {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return getAcademicSchoolDays(monthStart, monthEnd);
}

export function getAcademicYearSchoolDays(year: number): number {
  return getAcademicSchoolDays(`${year}-01-01`, `${year}-12-31`);
}

export function getAcademicTermSchoolDays(term: 1 | 2): number {
  return term === 1
    ? getAcademicSchoolDays('2026-01-25', '2026-07-16')
    : getAcademicSchoolDays('2026-08-02', '2026-12-17');
}
