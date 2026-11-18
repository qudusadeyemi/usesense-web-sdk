/* A rep's demos, one per prospect, kept in this browser. Each demo has its
   own settings (brand, industry, market) under its own storage key, read by a
   DemoProvider, and a record here: the story, what happened on the call, and
   the link sent afterwards. */
import { DEFAULT_SETTINGS, type DemoSettings } from './settings';
import { recommendedStory } from './story';

export interface DemoRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Scenario ids in the order they are presented; the opener first. */
  story: string[];
  /** Attacks the rep jumped to on a call. They go on the follow-up link. */
  extras: string[];
  rehearsedAt?: string;
  presentedAt?: string;
  /** The prospect link, once made. */
  shareId?: string;
  /** A booth link for events, once made. */
  boothId?: string;
}

const INDEX = 'xyz-demos-v2';
export const QUICK_ID = 'xyz';
export const settingsKey = (id: string) => `xyz-demo:${id}:settings`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full or blocked: the demo still works for this tab */
  }
}

function quick(): DemoRecord {
  const at = new Date(0).toISOString();
  return { id: QUICK_ID, createdAt: at, updatedAt: at, story: recommendedStory('bank'), extras: [] };
}

export function listDemos(): DemoRecord[] {
  const all = read<DemoRecord[]>(INDEX, []);
  return Array.isArray(all) ? all.filter((d) => d && d.id && d.id !== QUICK_ID) : [];
}

export function getDemo(id: string): DemoRecord | null {
  if (id === QUICK_ID) return read<DemoRecord | null>(`${INDEX}:quick`, null) ?? quick();
  return listDemos().find((d) => d.id === id) ?? null;
}

export function saveDemo(d: DemoRecord): DemoRecord {
  const next = { ...d, updatedAt: new Date().toISOString() };
  if (d.id === QUICK_ID) {
    write(`${INDEX}:quick`, next);
    return next;
  }
  const all = listDemos().filter((x) => x.id !== d.id);
  write(INDEX, [next, ...all].slice(0, 200));
  return next;
}

export function deleteDemo(id: string): void {
  write(INDEX, listDemos().filter((d) => d.id !== id));
  try { localStorage.removeItem(settingsKey(id)); } catch { /* ignore */ }
}

export function readSettings(id: string): DemoSettings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<DemoSettings>>(settingsKey(id), {}) };
}

/** "Northline Bank" -> "northline-bank-k3x". Short, readable, unique enough per browser. */
export function newDemoId(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'demo';
  return `${base}-${Math.random().toString(36).slice(2, 5)}`;
}

export function createDemo(settings: Partial<DemoSettings>, story: string[]): DemoRecord {
  const id = newDemoId(settings.prospect || settings.website || 'demo');
  write(settingsKey(id), { ...DEFAULT_SETTINGS, ...settings });
  const at = new Date().toISOString();
  return saveDemo({ id, createdAt: at, updatedAt: at, story, extras: [] });
}

/** Moves an item in the story, keeping the opener first. */
export function moveInStory(story: string[], id: string, delta: number): string[] {
  const i = story.indexOf(id);
  const j = i + delta;
  if (i < 1 || j < 1 || j >= story.length) return story;
  const next = [...story];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** The old single-demo settings, from before demos were per prospect. */
export function migrateOldSettings(): void {
  try {
    if (localStorage.getItem(`${INDEX}:migrated`)) return;
    localStorage.setItem(`${INDEX}:migrated`, '1');
    const old = read<Partial<DemoSettings> | null>('xyz-demo-settings-v1', null);
    if (!old) return;
    // Keys and live settings carry over to the quick demo; a named prospect becomes a demo.
    if (old.prospect) {
      createDemo(old, recommendedStory(old.industry ?? 'bank'));
    }
    write(settingsKey(QUICK_ID), { ...DEFAULT_SETTINGS, sandboxKey: old.sandboxKey ?? '', liveKey: old.liveKey ?? '', apiBaseUrl: old.apiBaseUrl ?? DEFAULT_SETTINGS.apiBaseUrl });
  } catch {
    /* ignore */
  }
}
