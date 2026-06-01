import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildMorningBriefingMarkdown,
  buildMorningBriefingText,
  buildMorningCommandPlan,
} from '../../domain/morning/morningBriefing';
import { fetchWeatherBrief, type WeatherBrief } from '../../domain/morning/weather';
import {
  createElevenLabsAudioUrl,
  getElevenLabsConfigStatus,
  isElevenLabsConfigured,
} from '../../domain/voice/elevenLabsTts';
import { normalizeSpeechRate } from '../../domain/voice/speechRate';
import type { AppSettings } from '../../domain/settings/settingsTypes';
import type { Reminder } from '../../domain/reminders/reminderTypes';
import type { Subtask, Task } from '../../domain/tasks/taskTypes';

export type CommandBlock = { time: string; title: string; description: string; tone?: string };

const MORNING_SECTION_PAUSE_MS = 650;

function splitVoiceSections(text: string): string[] {
  return text
    .split(/\n\s*\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

interface UseMorningBriefingInput {
  settings: AppSettings | null;
  tasks: Task[];
  subtasks: Subtask[];
  reminders: Reminder[];
  todayISO: string;
  leadTaskCount: number;
  appVersion: string;
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>;
  updateExistingTaskDetails: (id: string, patch: Partial<Task>) => Promise<void>;
  saveDailyPlan: (plan: {
    date: string;
    taskIds: string[];
    blocks: CommandBlock[];
    focusNote: string;
  }) => Promise<void>;
}

export interface UseMorningBriefingReturn {
  // state
  showMorningBriefing: boolean;
  setShowMorningBriefing: (v: boolean) => void;
  morningBriefingText: string;
  setMorningBriefingTextOverride: (v: string | null) => void;
  morningWeather: WeatherBrief | null;
  isMorningLoading: boolean;
  morningPlayProgress: number;
  availableVoices: SpeechSynthesisVoice[];
  isGeneratingVoice: boolean;
  isSpeaking: boolean;
  voiceError: string;
  morningPublishStatus: string;
  setMorningPublishStatus: (v: string) => void;
  selectedVoiceName: string;
  setSelectedVoiceName: (v: string) => void;
  elevenLabsReady: boolean;
  morningCommandPlan: ReturnType<typeof buildMorningCommandPlan>;
  voiceStatus: string;
  commandBlocks: CommandBlock[];
  commandStatus: string;
  // actions
  speakMorningBriefing: () => Promise<void>;
  stopMorningBriefing: () => void;
  openMorningBriefing: () => Promise<void>;
  playText: (text: string) => Promise<void>;
  downloadMorningBriefing: () => void;
  publishMorningBriefingForAndroid: () => Promise<void>;
  updateCommandBlock: (index: number, patch: Partial<CommandBlock>) => void;
  saveMorningCommandPlan: () => Promise<void>;
  setCommandCenterReady: (open: boolean) => void;
}

export function useMorningBriefing({
  settings,
  tasks,
  subtasks,
  reminders,
  todayISO,
  leadTaskCount,
  appVersion,
  saveSettings,
  updateExistingTaskDetails,
  saveDailyPlan,
}: UseMorningBriefingInput): UseMorningBriefingReturn {
  const [showMorningBriefing, setShowMorningBriefing] = useState(false);
  const [morningBriefingTextOverride, setMorningBriefingTextOverride] = useState<string | null>(null);
  const [morningWeather, setMorningWeather] = useState<WeatherBrief | null>(null);
  const [isMorningLoading, setIsMorningLoading] = useState(false);
  const [morningPlayProgress, setMorningPlayProgress] = useState(0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [morningPublishStatus, setMorningPublishStatus] = useState('');
  const [selectedVoiceName, setSelectedVoiceName] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('mission-control-morning-voice') ?? '';
  });
  const [commandBlocks, setCommandBlocks] = useState<CommandBlock[]>([]);
  const [commandStatus, setCommandStatus] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const voiceRunRef = useRef(0);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = normalizeSpeechRate(settings?.voice?.speechRate);
  }, [settings?.voice?.speechRate]);

  // ── Weather fetch on mount / settings change ──────────────────────────────
  useEffect(() => {
    if (!settings) return;
    let cancelled = false;
    void fetchWeatherBrief(settings, todayISO).then((weather) => {
      if (!cancelled) setMorningWeather(weather);
    });
    return () => { cancelled = true; };
  }, [settings, todayISO]);

  // ── Voices ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // ── Persist selected voice ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedVoiceName) {
      window.localStorage.setItem('mission-control-morning-voice', selectedVoiceName);
    }
  }, [selectedVoiceName]);

  // ── Play progress indicator ───────────────────────────────────────────────
  useEffect(() => {
    if (!isMorningLoading && !isGeneratingVoice && !isSpeaking) return;
    setMorningPlayProgress((current) => (current > 0 ? current : 8));
    const id = window.setInterval(() => {
      setMorningPlayProgress((current) => {
        if (isSpeaking) return 100;
        if (current >= 92) return current;
        return Math.min(92, current + 7);
      });
    }, 240);
    return () => window.clearInterval(id);
  }, [isMorningLoading, isGeneratingVoice, isSpeaking]);

  // ── Stop on unmount ───────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { stopMorningBriefing(); }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const baseMorningBriefingText = useMemo(
    () =>
      buildMorningBriefingText({
        todayISO,
        settings,
        tasks,
        subtasks,
        reminders,
        leadTaskCount,
        weather: morningWeather,
      }),
    [todayISO, settings, tasks, subtasks, reminders, leadTaskCount, morningWeather],
  );

  const morningBriefingText = morningBriefingTextOverride ?? baseMorningBriefingText;
  const elevenLabsReady = isElevenLabsConfigured(settings);
  const morningCommandPlan = useMemo(
    () =>
      buildMorningCommandPlan({
        todayISO,
        settings,
        tasks,
        subtasks,
        reminders,
        leadTaskCount,
        weather: morningWeather,
      }),
    [todayISO, settings, tasks, subtasks, reminders, leadTaskCount, morningWeather],
  );
  const voiceStatus = useMemo(() => getElevenLabsConfigStatus(settings).message, [settings]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const cleanupAudioObjectUrl = useCallback(() => {
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
  }, []);

  const getPreferredVoice = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices =
      availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    if (selectedVoiceName) {
      const selected = voices.find((v) => v.name === selectedVoiceName);
      if (selected) return selected;
    }
    const ranked = voices
      .filter((v) => /he|hebrew|israel|עברית/i.test(`${v.lang} ${v.name}`))
      .sort((a, b) => {
        const score = (v: SpeechSynthesisVoice) => {
          const h = `${v.name} ${v.lang}`.toLowerCase();
          return (
            (h.includes('natural') ? 30 : 0) +
            (h.includes('online') ? 20 : 0) +
            (h.includes('microsoft') ? 10 : 0) +
            (h.includes('google') ? 8 : 0) +
            (h.includes('he-il') ? 6 : 0) +
            (v.localService ? 1 : 0)
          );
        };
        return score(b) - score(a);
      });
    return ranked[0] ?? null;
  }, [availableVoices, selectedVoiceName]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  function stopMorningBriefing() {
    voiceRunRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    cleanupAudioObjectUrl();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsGeneratingVoice(false);
    setIsSpeaking(false);
  }

  const speakText = useCallback(
    (text: string, runId: number) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const preferredVoice = getPreferredVoice();
      const chunks = splitVoiceSections(text);
      if (chunks.length === 0) return;
      setIsSpeaking(true);
      const speakChunk = (index: number) => {
        if (voiceRunRef.current !== runId) return;
        const chunk = chunks[index];
        if (!chunk) {
          setIsSpeaking(false);
          return;
        }
        const utterance = new SpeechSynthesisUtterance(chunk);
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.lang = preferredVoice?.lang || 'he-IL';
        utterance.rate = normalizeSpeechRate(settings?.voice?.speechRate);
        utterance.pitch = 0.98;
        utterance.volume = 1;
        utterance.onend = () => {
          window.setTimeout(() => speakChunk(index + 1), MORNING_SECTION_PAUSE_MS);
        };
        utterance.onerror = () => {
          window.setTimeout(() => speakChunk(index + 1), MORNING_SECTION_PAUSE_MS);
        };
        window.speechSynthesis.speak(utterance);
      };
      speakChunk(0);
    },
    [getPreferredVoice, settings?.voice?.speechRate],
  );

  const playTextWithEngine = useCallback(
    async (text: string) => {
      stopMorningBriefing();
      const runId = voiceRunRef.current + 1;
      voiceRunRef.current = runId;
      setVoiceError('');

      const voiceConfig = settings?.voice;
      if (voiceConfig?.engine === 'elevenlabs' && !isElevenLabsConfigured(settings)) {
        if (!voiceConfig.elevenLabsVoiceId?.trim()) {
          setVoiceError(
            'ElevenLabs נבחר, אבל חסר Voice ID. תוסיף Voice ID בהגדרות או בחר קול דפדפן זמני.',
          );
        } else if (!voiceConfig.elevenLabsApiKey?.trim() && !voiceConfig.elevenLabsProxyUrl?.trim()) {
          setVoiceError('ElevenLabs נבחר, אבל חסר API Key או Proxy URL.');
        }
      }

      if (isElevenLabsConfigured(settings)) {
        const chunks = splitVoiceSections(text);
        setIsSpeaking(true);
        for (const chunk of chunks) {
          if (voiceRunRef.current !== runId) return;
          setIsGeneratingVoice(true);
          const result = await createElevenLabsAudioUrl(chunk, settings);
          setIsGeneratingVoice(false);
          if (voiceRunRef.current !== runId) {
            if (result.audioUrl) URL.revokeObjectURL(result.audioUrl);
            return;
          }
          if (!result.ok || !result.audioUrl) {
            setVoiceError(result.error || 'ElevenLabs לא הצליח ליצור אודיו. נופל לקול דפדפן.');
            if (voiceRunRef.current === runId) setIsSpeaking(false);
            speakText(text, runId);
            return;
          }

          cleanupAudioObjectUrl();
          currentAudioUrlRef.current = result.audioUrl;
          const audio = new Audio(result.audioUrl);
          audio.playbackRate = normalizeSpeechRate(settings?.voice?.speechRate);
          audioRef.current = audio;
          try {
            await new Promise<void>((resolve, reject) => {
              audio.onended = () => resolve();
              audio.onerror = () => reject(new Error('Audio playback failed'));
              void audio.play().catch(reject);
            });
          } catch (error) {
            if (voiceRunRef.current === runId) setIsSpeaking(false);
            setVoiceError(
              error instanceof Error ? error.message : 'הדפדפן חסם את ההשמעה. לחץ שוב על הקריא.',
            );
            cleanupAudioObjectUrl();
            return;
          }
          cleanupAudioObjectUrl();
          if (voiceRunRef.current === runId) await wait(MORNING_SECTION_PAUSE_MS);
        }
        if (voiceRunRef.current === runId) setIsSpeaking(false);
        return;
      }

      speakText(text, runId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, cleanupAudioObjectUrl, speakText],
  );

  const speakMorningBriefing = useCallback(async () => {
    if (isGeneratingVoice || isSpeaking || isMorningLoading) {
      stopMorningBriefing();
      setIsMorningLoading(false);
      setMorningPlayProgress(0);
      return;
    }
    setVoiceError('');
    setMorningPublishStatus('');
    setMorningPlayProgress(8);
    setIsMorningLoading(true);
    const weather = await fetchWeatherBrief(settings, todayISO);
    setMorningWeather(weather);
    const nextText = buildMorningBriefingText({
      todayISO,
      settings,
      tasks,
      subtasks,
      reminders,
      leadTaskCount,
      weather,
    });
    setMorningBriefingTextOverride(nextText);
    setIsMorningLoading(false);
    setMorningPlayProgress(35);
    await playTextWithEngine(nextText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGeneratingVoice, isSpeaking, isMorningLoading, settings, todayISO, tasks, subtasks, reminders, leadTaskCount, playTextWithEngine]);

  const openMorningBriefing = useCallback(async () => {
    setShowMorningBriefing(true);
    setIsMorningLoading(true);
    const weather = await fetchWeatherBrief(settings, todayISO);
    setMorningWeather(weather);
    const nextText = buildMorningBriefingText({
      todayISO,
      settings,
      tasks,
      subtasks,
      reminders,
      leadTaskCount,
      weather,
    });
    setMorningBriefingTextOverride(nextText);
    setIsMorningLoading(false);
    setTimeout(() => {
      void playTextWithEngine(nextText);
    }, 250);
  }, [settings, todayISO, tasks, subtasks, reminders, leadTaskCount, playTextWithEngine]);

  const downloadMorningBriefing = useCallback(() => {
    const markdown = buildMorningBriefingMarkdown({
      todayISO,
      settings,
      tasks,
      subtasks,
      reminders,
      leadTaskCount,
      weather: morningWeather,
    });
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mission-control-morning-briefing-${todayISO}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [todayISO, settings, tasks, subtasks, reminders, leadTaskCount, morningWeather]);

  const publishMorningBriefingForAndroid = useCallback(async () => {
    setMorningPublishStatus('');
    const morningSettings = settings?.morningBriefing;
    const endpoint = morningSettings?.androidPublishEndpoint?.trim() || '/api/morning-briefing';
    const token = morningSettings?.androidPublishToken?.trim();
    if (!token) {
      setMorningPublishStatus('חסר Token בהגדרות > נאום בוקר > Android Morning Alarm.');
      return;
    }
    const payload = {
      token,
      date: todayISO,
      alarmTime: morningSettings?.alarmTime || '07:00',
      ringtoneUrl: morningSettings?.ringtoneUrl || '',
      text: morningBriefingText,
      source: 'mission-control',
      appVersion,
    };
    setMorningPublishStatus('מפרסם ל־Android / Supabase...');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const dataResponse = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        url?: string;
      } | null;
      if (!response.ok || dataResponse?.ok === false) {
        throw new Error(dataResponse?.error || `HTTP ${response.status}`);
      }
      setMorningPublishStatus(
        dataResponse?.url
          ? `פורסם. בדיקת אנדרואיד: ${dataResponse.url}`
          : 'פורסם בהצלחה ל־Supabase.',
      );
      if (settings) {
        await saveSettings({
          morningBriefing: {
            ...settings.morningBriefing,
            lastPublishedAt: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      setMorningPublishStatus(
        `פרסום נכשל: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`,
      );
    }
  }, [settings, todayISO, morningBriefingText, appVersion, saveSettings]);

  const updateCommandBlock = useCallback((index: number, patch: Partial<CommandBlock>) => {
    setCommandBlocks((blocks) =>
      blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)),
    );
    setCommandStatus('');
  }, []);

  const saveMorningCommandPlan = useCallback(async () => {
    const topTaskIds = morningCommandPlan.topTasks.map((t) => t.id);
    for (const taskId of topTaskIds) {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) continue;
      const tags = Array.from(new Set([...(task.tags ?? []), 'morning-important']));
      await updateExistingTaskDetails(taskId, { tags });
    }
    await saveDailyPlan({
      date: todayISO,
      taskIds: topTaskIds,
      blocks: commandBlocks.length ? commandBlocks : morningCommandPlan.planBlocks,
      focusNote: 'Morning Command Center plan',
    });
    setCommandStatus('תוכנית היום נשמרה. 3 המשימות החשובות סומנו לבוקר.');
  }, [morningCommandPlan, tasks, todayISO, commandBlocks, updateExistingTaskDetails, saveDailyPlan]);

  const setCommandCenterReady = useCallback(
    (open: boolean) => {
      if (!open) return;
      setCommandStatus('');
      setCommandBlocks(morningCommandPlan.planBlocks.map((block) => ({ ...block })));
    },
    [morningCommandPlan],
  );

  return {
    showMorningBriefing,
    setShowMorningBriefing,
    morningBriefingText,
    setMorningBriefingTextOverride,
    morningWeather,
    isMorningLoading,
    morningPlayProgress,
    availableVoices,
    isGeneratingVoice,
    isSpeaking,
    voiceError,
    morningPublishStatus,
    setMorningPublishStatus,
    selectedVoiceName,
    setSelectedVoiceName,
    elevenLabsReady,
    morningCommandPlan,
    voiceStatus,
    commandBlocks,
    commandStatus,
    speakMorningBriefing,
    stopMorningBriefing,
    openMorningBriefing,
    playText: playTextWithEngine,
    downloadMorningBriefing,
    publishMorningBriefingForAndroid,
    updateCommandBlock,
    saveMorningCommandPlan,
    setCommandCenterReady,
  };
}
