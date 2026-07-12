import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/badge';
import { Field, Input, Select, PrimaryButton, SecondaryButton } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';
import { fmtDateTime, fmtTime, apiErrorMessage } from '@/lib/format';
import type { Asset, Booking } from '@/types';

const DAY_START = 7; // calendar shows 07:00 – 21:00
const DAY_END = 21;
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BookingsPage() {
  const { user } = useAuthStore();
  const [resources, setResources] = useState<Asset[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ startTime: '', endTime: '' });
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient
      .get('/assets?isBookable=true')
      .then(({ data }) => {
        setResources(data.data);
        if (data.data.length && !selectedId) setSelectedId(data.data[0].id);
      })
      .catch(() => toast.error('Failed to load bookable resources'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBookings = useCallback(async () => {
    if (!selectedId) return;
    try {
      const [{ data: res }, { data: mine }] = await Promise.all([
        apiClient.get(`/bookings?assetId=${selectedId}`),
        apiClient.get('/bookings?mine=true'),
      ]);
      setBookings(res.data);
      setMyBookings(mine.data);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load bookings'));
    }
  }, [selectedId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const selectedResource = resources.find((r) => r.id === selectedId);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  const visibleBookings = bookings.filter((b) => b.status !== 'CANCELLED');

  function bookingsForDay(day: Date) {
    const dayStart = new Date(day);
    const dayEnd = new Date(day);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return visibleBookings.filter((b) => {
      const s = new Date(b.startTime);
      return s >= dayStart && s < dayEnd;
    });
  }

  const openNewBooking = (day?: Date, hour?: number) => {
    setOverlapError(null);
    setRescheduling(null);
    const base = day ? new Date(day) : new Date();
    base.setHours(hour ?? 9, 0, 0, 0);
    const end = new Date(base);
    end.setHours(base.getHours() + 1);
    setForm({ startTime: toLocalInput(base), endTime: toLocalInput(end) });
    setModalOpen(true);
  };

  const openReschedule = (b: Booking) => {
    setOverlapError(null);
    setRescheduling(b);
    setForm({ startTime: toLocalInput(new Date(b.startTime)), endTime: toLocalInput(new Date(b.endTime)) });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setOverlapError(null);
    try {
      if (rescheduling) {
        await apiClient.patch(`/bookings/${rescheduling.id}`, {
          action: 'reschedule',
          startTime: new Date(form.startTime).toISOString(),
          endTime: new Date(form.endTime).toISOString(),
        });
        toast.success('Booking rescheduled');
      } else {
        await apiClient.post('/bookings', {
          assetId: selectedId,
          startTime: new Date(form.startTime).toISOString(),
          endTime: new Date(form.endTime).toISOString(),
        });
        toast.success('Booking confirmed');
      }
      setModalOpen(false);
      fetchBookings();
    } catch (err: unknown) {
      const e409 = err as {
        response?: {
          status?: number;
          data?: { details?: { conflictingBooking?: { startTime: string; endTime: string; bookedByName: string } } };
        };
      };
      if (e409?.response?.status === 409) {
        const c = e409.response?.data?.details?.conflictingBooking;
        setOverlapError(
          c
            ? `This slot overlaps ${c.bookedByName}'s booking (${fmtTime(c.startTime)} – ${fmtTime(c.endTime)}). Slots may start exactly when another ends — pick a different time.`
            : 'This slot overlaps an existing booking.'
        );
      } else {
        toast.error(apiErrorMessage(err, 'Failed to save booking'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const cancelBooking = async (b: Booking) => {
    try {
      await apiClient.patch(`/bookings/${b.id}`, { action: 'cancel' });
      toast.success('Booking cancelled');
      fetchBookings();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to cancel booking'));
    }
  };

  const shiftWeek = (dir: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(d);
  };

  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Resource Booking</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Book shared rooms, vehicles and equipment by time slot — overlaps are rejected automatically.
          </p>
        </div>
        <PrimaryButton type="button" onClick={() => openNewBooking()} disabled={!selectedId}>
          <Plus className="h-4 w-4" /> Book Resource
        </PrimaryButton>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : resources.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-16 text-muted-foreground">
          <CalendarDays className="h-8 w-8" />
          <p className="text-sm font-medium">No bookable resources yet</p>
          <p className="text-xs">Ask an Asset Manager to mark assets as “shared/bookable”.</p>
        </div>
      ) : (
        <>
          {/* Resource picker + week nav */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-72">
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.assetTag}){r.location ? ` — ${r.location}` : ''}
                </option>
              ))}
            </Select>
            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftWeek(-1)}
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setWeekStart(startOfWeek(new Date()))}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Today
              </button>
              <button
                onClick={() => shiftWeek(1)}
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="ml-2 text-sm font-medium text-foreground">
                {weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
                {weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Week calendar */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <div className="grid min-w-[900px] grid-cols-[56px_repeat(7,1fr)]">
              {/* Header row */}
              <div className="border-b border-border" />
              {weekDays.map((day) => {
                const isToday = day.toDateString() === today.toDateString();
                return (
                  <div
                    key={day.toISOString()}
                    className={`border-b border-l border-border px-2 py-2.5 text-center ${isToday ? 'bg-primary/5' : ''}`}
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {day.toLocaleDateString(undefined, { weekday: 'short' })}
                    </p>
                    <p className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                      {day.getDate()}
                    </p>
                  </div>
                );
              })}

              {/* Hour rows */}
              {HOURS.map((hour) => (
                <div key={hour} className="contents">
                  <div className="border-b border-border py-1 pr-2 text-right text-[11px] text-muted-foreground">
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  {weekDays.map((day) => {
                    const isToday = day.toDateString() === today.toDateString();
                    const cellBookings = bookingsForDay(day).filter(
                      (b) => new Date(b.startTime).getHours() === hour
                    );
                    return (
                      <div
                        key={`${day.toISOString()}-${hour}`}
                        onClick={() => cellBookings.length === 0 && openNewBooking(day, hour)}
                        className={`relative h-11 cursor-pointer border-b border-l border-border transition-colors hover:bg-primary/5 ${isToday ? 'bg-primary/[0.02]' : ''}`}
                      >
                        {cellBookings.map((b) => {
                          const s = new Date(b.startTime);
                          const e = new Date(b.endTime);
                          const durationHrs = Math.min(
                            (e.getTime() - s.getTime()) / 36e5,
                            DAY_END - s.getHours()
                          );
                          const mine = b.bookedById === user?.id;
                          return (
                            <div
                              key={b.id}
                              title={`${b.bookedBy?.name}: ${fmtTime(b.startTime)} – ${fmtTime(b.endTime)}`}
                              style={{ height: `${durationHrs * 44 - 4}px`, top: `${(s.getMinutes() / 60) * 44}px` }}
                              className={`absolute inset-x-0.5 z-10 overflow-hidden rounded-md border px-1.5 py-0.5 text-[10px] leading-tight ${
                                b.status === 'ONGOING'
                                  ? 'border-emerald-300 bg-emerald-100 text-emerald-900'
                                  : mine
                                    ? 'border-primary/40 bg-primary/15 text-primary'
                                    : 'border-blue-200 bg-blue-50 text-blue-800'
                              }`}
                            >
                              <p className="truncate font-semibold">{b.bookedBy?.name}</p>
                              <p className="truncate">
                                {fmtTime(b.startTime)}–{fmtTime(b.endTime)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Click an empty slot to book {selectedResource?.name ?? 'this resource'} at that time.
          </p>

          {/* My bookings */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-foreground">My Bookings</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Resource</th>
                    <th className="px-4 py-3 font-medium">Start</th>
                    <th className="px-4 py-3 font-medium">End</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {myBookings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        You haven't booked anything yet.
                      </td>
                    </tr>
                  ) : (
                    myBookings.map((b) => (
                      <tr key={b.id} className="transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">{b.asset?.name}</span>
                          <span className="ml-2 font-mono text-xs text-primary">{b.asset?.assetTag}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(b.startTime)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(b.endTime)}</td>
                        <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                        <td className="px-4 py-3 text-right">
                          {['UPCOMING', 'ONGOING'].includes(b.status) && (
                            <div className="flex justify-end gap-2">
                              {b.status === 'UPCOMING' && (
                                <button
                                  onClick={() => openReschedule(b)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                                >
                                  <Clock className="h-3.5 w-3.5" /> Reschedule
                                </button>
                              )}
                              <button
                                onClick={() => cancelBooking(b)}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20 transition-colors hover:bg-red-100"
                              >
                                <XCircle className="h-3.5 w-3.5" /> Cancel
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Booking modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={rescheduling ? 'Reschedule Booking' : `Book ${selectedResource?.name ?? 'Resource'}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {overlapError && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-red-600" />
              <p className="text-sm text-red-800">{overlapError}</p>
            </div>
          )}
          <Field label="Start time" required>
            <Input
              type="datetime-local"
              required
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </Field>
          <Field label="End time" required>
            <Input
              type="datetime-local"
              required
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <SecondaryButton type="button" onClick={() => setModalOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={submitting}>
              <CalendarDays className="h-4 w-4" /> {rescheduling ? 'Reschedule' : 'Confirm Booking'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
