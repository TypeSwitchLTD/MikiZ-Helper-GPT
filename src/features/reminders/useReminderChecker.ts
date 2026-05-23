import { useEffect, useRef } from 'react';
import { localISOSeconds } from '../../utils/dates';
import type { Reminder } from '../../domain/reminders/reminderTypes';

const POLL_MS = 60_000;

/**
 * Keys that already fired this session — format: `${id}:${remindAt}` so that
 * a snoozed reminder (new remindAt) fires again even with the same ID.
 */
const firedThisSession = new Set<string>();

/** Plays a pleasant 3-note chime via Web Audio API */
function playReminderChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Resume first — Chrome suspends AudioContext until a user gesture has occurred
    const scheduleNotes = () => {
      // Three rising notes: E5 → G#5 → B5 (major-triad arpeggio)
      const notes = [659.25, 830.61, 987.77];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;

        const startTime = ctx.currentTime + i * 0.16;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.13, startTime + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.5);
      });
      window.setTimeout(() => void ctx.close(), 1400);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(scheduleNotes).catch(() => undefined);
    } else {
      scheduleNotes();
    }
  } catch {
    // Audio is best-effort
  }
}

/** Fire OS notification — prefers SW (works cross-tab/background) with direct API as fallback */
function fireBrowserNotification(reminder: Reminder): void {
  playReminderChime();

  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const options: NotificationOptions = {
    body: reminder.note || 'לחץ לפתיחת האפליקציה',
    icon: '/icon.svg',
    tag: reminder.id,
    silent: true, // we play our own chime — suppress the OS default sound
    data: { reminderId: reminder.id, taskId: reminder.taskId ?? null },
  };

  // Use the SW registration when available → fires even in other tabs / background
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(reminder.title, options))
      .catch(() => {
        // SW not ready — fall back to direct API
        try { new Notification(reminder.title, options); } catch { /* ignore */ }
      });
    return;
  }

  try { new Notification(reminder.title, options); } catch { /* ignore */ }
}

/**
 * Call this once when the user explicitly creates a reminder.
 * Requesting permission at that moment feels natural and expected.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

/**
 * Polls every 60 s for due reminders.
 * - Plays a pleasant chime and fires a cross-tab OS notification for each newly-due reminder.
 * - Calls onDue() immediately when reminders fire so the toast updates in sync with the chime.
 * - Does NOT mark reminders as sent — the user must act via ReminderToast.
 */
export function useReminderChecker(reminders: Reminder[], onDue?: () => void): void {
  const remindersRef = useRef<Reminder[]>(reminders);
  remindersRef.current = reminders;
  const onDueRef = useRef(onDue);
  onDueRef.current = onDue;

  useEffect(() => {
    function check(): void {
      const nowISO = localISOSeconds(); // local time — matches how remindAt is stored
      const due = remindersRef.current.filter((r) => {
        const key = `${r.id}:${r.remindAt}`;
        return r.status === 'pending' && r.remindAt <= nowISO && !firedThisSession.has(key);
      });
      if (due.length > 0) {
        due.forEach((r) => {
          firedThisSession.add(`${r.id}:${r.remindAt}`);
          fireBrowserNotification(r);
        });
        onDueRef.current?.(); // sync toast update with chime
      }
    }

    check(); // run immediately on mount
    const timer = setInterval(check, POLL_MS);
    return () => clearInterval(timer);
  }, []); // stable — uses refs
}
