export interface CscContentItem {
  description: string;
  eyebrow: string;
  id: string;
  note: string;
  title: string;
}

export interface CscContentResponse {
  items: CscContentItem[];
  updatedAt: string | null;
}

export const DEFAULT_CSC_CONTENT: CscContentItem[] = [
  {
    id: "events",
    eyebrow: "CSC publicity",
    title: "Upcoming RC4 events",
    description: "A rotating space for committee posters, event details and venue information.",
    note: "Designed for content supplied by CSC",
  },
  {
    id: "deadlines",
    eyebrow: "Time-sensitive",
    title: "Sign-up deadlines",
    description: "Important registration windows stay visible without crowding the live transport panel.",
    note: "Expired notices can be removed automatically",
  },
  {
    id: "updates",
    eyebrow: "College updates",
    title: "Selected RC4 announcements",
    description: "A focused channel for relevant notices, reminders and community opportunities.",
    note: "Curated for quick-glance viewing",
  },
];

declare global {
  var rc4CscContent: CscContentResponse | undefined;
}

export function getCscContent(): CscContentResponse {
  return globalThis.rc4CscContent ?? {
    items: DEFAULT_CSC_CONTENT.map((item) => ({ ...item })),
    updatedAt: null,
  };
}

function readText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${field} must be ${maxLength} characters or fewer`);
  return text;
}

export function updateCscContent(input: unknown): CscContentResponse {
  if (!Array.isArray(input) || input.length !== 3) throw new Error("Exactly three highlight cards are required");
  const items = input.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`Highlight ${index + 1} is invalid`);
    const item = value as Record<string, unknown>;
    return {
      id: readText(item.id, `Highlight ${index + 1} ID`, 40),
      eyebrow: readText(item.eyebrow, `Highlight ${index + 1} label`, 32),
      title: readText(item.title, `Highlight ${index + 1} title`, 64),
      description: readText(item.description, `Highlight ${index + 1} description`, 180),
      note: readText(item.note, `Highlight ${index + 1} note`, 80),
    };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error("Highlight IDs must be unique");
  globalThis.rc4CscContent = { items, updatedAt: new Date().toISOString() };
  return globalThis.rc4CscContent;
}
