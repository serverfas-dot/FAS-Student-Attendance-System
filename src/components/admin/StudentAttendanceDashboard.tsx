import React, { useState } from 'react';
import { CalendarDays, Check, Clock3, GraduationCap, Home, Users, UserRound, X, HeartPulse, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type StudentProfile = {
  id: string;
  indexNumber: string;
  name: string;
  photo?: string;
  grade: string;
  house: string;
  position: string;
};

type MonthlyAttendance = {
  month: string;
  schoolDays: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
};

type DayBreakdownEntry = {
  date: string;
  before_break?: string;
  after_break?: string;
  day_status: string;
};

type StudentAttendance = {
  present: number;
  absent: number;
  sick: number;
  late: number;
  totalSchoolDays: number;
  monthlyAttendance: MonthlyAttendance[];
  dayBreakdown?: DayBreakdownEntry[];
};

type StudentAttendanceDashboardProps = {
  student: StudentProfile;
  attendance: StudentAttendance;
};

const summaryCards = [
  { key: 'present', label: 'Present', color: 'green', icon: Check },
  { key: 'absent', label: 'Absent', color: 'red', icon: X },
  { key: 'sick', label: 'Sick', color: 'yellow', icon: HeartPulse },
  { key: 'late', label: 'Late', color: 'amber', icon: Clock3 },
] as const;

const colorClasses = {
  green: { card: 'bg-emerald-50 border-emerald-100', icon: 'bg-emerald-100 text-emerald-700', number: 'text-emerald-900' },
  red: { card: 'bg-red-50 border-red-100', icon: 'bg-red-100 text-red-700', number: 'text-red-900' },
  yellow: { card: 'bg-yellow-50 border-yellow-100', icon: 'bg-yellow-100 text-yellow-700', number: 'text-yellow-900' },
  amber: { card: 'bg-amber-50 border-amber-100', icon: 'bg-amber-100 text-amber-700', number: 'text-amber-900' },
};

function getMonthLabel(month: string): string {
  return month.slice(0, 3);
}

function getMonthYear(month: string): string {
  return month.includes('-') ? month.slice(0, 7) : month;
}

export default function StudentAttendanceDashboard({ student, attendance }: StudentAttendanceDashboardProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const attendanceRate = attendance.totalSchoolDays > 0
    ? Math.round((attendance.present / attendance.totalSchoolDays) * 100)
    : 0;
  const donutData = [
    { name: 'Present', value: attendance.present, color: '#16a34a' },
    { name: 'Not present', value: Math.max(0, attendance.totalSchoolDays - attendance.present), color: '#e5e7eb' },
  ];
  const chartData = attendance.monthlyAttendance.map((month) => ({
    month: getMonthLabel(month.month),
    attendance: month.attendanceRate,
  }));

  return (
    <div className="-mx-2 overflow-hidden rounded-2xl bg-slate-100 md:-mx-4">
      <header className="flex flex-col gap-5 bg-[#0b3b78] px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between md:px-7">
        <div className="flex items-center gap-3">
          <button
            type="button"
            title="Open calendar"
            onClick={() => setShowCalendar(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20 cursor-pointer"
          >
            <CalendarDays className="h-6 w-6" />
          </button>
          <div><h2 className="text-lg font-bold">Student Attendance Card</h2><p className="text-xs text-blue-100">Track · Monitor · Support</p></div>
        </div>
        <div className="text-left sm:text-right"><p className="text-sm font-semibold">Faafu Atoll School</p></div>
      </header>

      <div className="grid gap-5 p-4 md:grid-cols-[270px_minmax(0,1fr)] md:p-6 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="relative mx-auto h-40 w-40 overflow-hidden rounded-2xl bg-blue-50 ring-4 ring-blue-50">
            <img src={student.photo || '/png.png'} alt={student.name} className="h-full w-full object-cover" />
          </div>
          <div className="mt-5 text-center"><h3 className="text-xl font-bold text-slate-900">{student.name}</h3><p className="mt-1 text-sm text-slate-500">Student Profile</p></div>
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-sm">
            <ProfileRow icon={UserRound} label="Index No" value={student.indexNumber} />
            <ProfileRow icon={GraduationCap} label="Grade" value={student.grade} />
            <ProfileRow icon={Home} label="House" value={student.house} />
            <ProfileRow icon={Users} label="Position" value={student.position} />
          </div>
          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <p className="text-sm font-semibold text-slate-700">Overall Attendance</p>
            <div className="relative mx-auto mt-4 h-40 w-40">
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={donutData} dataKey="value" innerRadius={53} outerRadius={69} startAngle={90} endAngle={-270} stroke="none"><Cell fill="#16a34a" /><Cell fill="#e5e7eb" /></Pie></PieChart></ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold text-slate-900">{attendanceRate}%</span><span className="text-xs text-slate-500">attendance</span></div>
            </div>
            <p className="mt-2 text-sm text-slate-500">{attendance.present} / {attendance.totalSchoolDays} days</p>
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {summaryCards.map(({ key, label, color, icon: Icon }) => {
              const styles = colorClasses[color];
              const value = attendance[key];
              const percentage = attendance.totalSchoolDays > 0 ? Math.round((value / attendance.totalSchoolDays) * 100) : 0;
              return <SummaryCard key={key} label={label} value={value} percentage={percentage} styles={styles} icon={Icon} />;
            })}
            <SummaryCard label="School Days" value={attendance.totalSchoolDays} styles={{ card: 'bg-blue-50 border-blue-100', icon: 'bg-blue-100 text-blue-700', number: 'text-blue-900' }} icon={CalendarDays} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(270px,0.8fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Performance trend</p><h3 className="mt-1 text-lg font-bold text-slate-900">Attendance History</h3><p className="text-sm text-slate-500">Monthly attendance percentage</p></div>
              {chartData.length > 0 ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0.03} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`${value ?? 0}%`, 'Attendance']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} /><Area type="monotone" dataKey="attendance" stroke="#2563eb" strokeWidth={3} fill="url(#attendanceFill)" dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} /></AreaChart></ResponsiveContainer></div> : <EmptyChart />}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Monthly view</p><h3 className="mt-1 text-lg font-bold text-slate-900">Attendance by Month</h3></div><div className="space-y-4">{attendance.monthlyAttendance.map((month) => <div key={month.month}><div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-medium text-slate-600">{getMonthYear(month.month)}</span><span className="font-bold text-slate-800">{month.attendanceRate}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${month.attendanceRate}%` }} /></div></div>)}</div></section>
          </div>
        </main>
      </div>

      {showCalendar && (
        <YearCalendarModal
          studentName={student.name}
          dayBreakdown={attendance.dayBreakdown || []}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  );
}

function ProfileRow({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-xs text-slate-400">{label}</p><p className="truncate font-semibold text-slate-800">{value}</p></div></div>;
}

function SummaryCard({ label, value, percentage, styles, icon: Icon }: { label: string; value: number; percentage?: number; styles: { card: string; icon: string; number: string }; icon: typeof Check }) {
  return <div className={`rounded-2xl border p-4 shadow-sm ${styles.card}`}><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${styles.number}`}>{value}</p>{percentage !== undefined && <p className="mt-1 text-xs font-medium text-slate-500">{percentage}% of school days</p>}</div><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${styles.icon}`}><Icon className="h-5 w-5" /></span></div></div>;
}

function EmptyChart() {
  return <div className="flex h-64 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">No monthly attendance data available.</div>;
}

const statusStyles: Record<string, string> = {
  present: 'bg-emerald-500 text-white',
  late: 'bg-amber-500 text-white',
  sick: 'bg-yellow-400 text-yellow-900',
  absent: 'bg-red-500 text-white',
};

function YearCalendarModal({ studentName, dayBreakdown, onClose }: {
  studentName: string;
  dayBreakdown: DayBreakdownEntry[];
  onClose: () => void;
}) {
  const years = Array.from(new Set(dayBreakdown.map(d => new Date(d.date + 'T00:00:00').getFullYear()))).sort();
  const defaultYear = years.length > 0 ? years[years.length - 1] : new Date().getFullYear();
  const [calYear, setCalYear] = useState(defaultYear);

  const dayMap: Record<string, DayBreakdownEntry> = {};
  dayBreakdown.forEach(d => { dayMap[d.date] = d; });

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dowLabels = ['S','M','T','W','T','F','S'];

  const yearEntries = dayBreakdown.filter(d => new Date(d.date + 'T00:00:00').getFullYear() === calYear);
  const yearCounts = { present: 0, late: 0, sick: 0, absent: 0, total: yearEntries.length };
  yearEntries.forEach(d => {
    const s = d.day_status;
    if (s === 'present') yearCounts.present++;
    else if (s === 'late') yearCounts.late++;
    else if (s === 'sick') yearCounts.sick++;
    else if (s === 'absent') yearCounts.absent++;
  });
  const yearRate = yearCounts.total > 0 ? Math.round(((yearCounts.present + yearCounts.late) / yearCounts.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Yearly Attendance Calendar</h3>
              <p className="text-sm text-slate-500">{studentName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button onClick={() => setCalYear(y => y - 1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="Previous year">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[3rem] text-center text-sm font-bold text-slate-700">{calYear}</span>
              <button onClick={() => setCalYear(y => y + 1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="Next year">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{calYear} Summary</span>
              <span className="flex items-center gap-1 text-xs text-slate-600"><span className="h-2.5 w-2.5 rounded bg-emerald-500" /> {yearCounts.present}</span>
              <span className="flex items-center gap-1 text-xs text-slate-600"><span className="h-2.5 w-2.5 rounded bg-amber-500" /> {yearCounts.late}</span>
              <span className="flex items-center gap-1 text-xs text-slate-600"><span className="h-2.5 w-2.5 rounded bg-yellow-400" /> {yearCounts.sick}</span>
              <span className="flex items-center gap-1 text-xs text-slate-600"><span className="h-2.5 w-2.5 rounded bg-red-500" /> {yearCounts.absent}</span>
              <span className="ml-1 text-xs font-bold text-slate-700">{yearRate}%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {monthNames.map((monthName, mIdx) => {
              const firstDay = new Date(calYear, mIdx, 1);
              const startDow = firstDay.getDay();
              const daysInMonth = new Date(calYear, mIdx + 1, 0).getDate();
              const cells: (number | null)[] = [];
              for (let i = 0; i < startDow; i++) cells.push(null);
              for (let d = 1; d <= daysInMonth; d++) cells.push(d);

              return (
                <div key={mIdx} className="rounded-xl border border-slate-200 p-3">
                  <h4 className="mb-2 text-center text-sm font-bold text-slate-700">{monthName}</h4>
                  <div className="grid grid-cols-7 gap-0.5 text-center">
                    {dowLabels.map((d, i) => (
                      <div key={i} className="pb-1 text-[10px] font-semibold text-slate-400">{d}</div>
                    ))}
                    {cells.map((day, i) => {
                      if (day === null) return <div key={i} />;
                      const dateStr = `${calYear}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const entry = dayMap[dateStr];
                      const status = entry?.day_status;
                      const styleClass = status ? statusStyles[status] || 'bg-slate-200 text-slate-600' : 'bg-slate-50 text-slate-400';
                      return (
                        <div
                          key={i}
                          title={entry ? `${dateStr}: ${status}` : dateStr}
                          className={`flex h-7 items-center justify-center rounded text-[10px] font-medium ${styleClass}`}
                        >
                          {day}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-emerald-500" /> Present</span>
            <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-amber-500" /> Late</span>
            <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-yellow-400" /> Sick</span>
            <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-red-500" /> Absent</span>
            <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-slate-50 border border-slate-200" /> No record</span>
          </div>
        </div>
      </div>
    </div>
  );
}
