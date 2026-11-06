import { get, put } from "@vercel/blob";

const CONTENT_PATH = "rc4-bus-timings-dashboard/highlights/content.json";

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

function defaultContent(): CscContentResponse {
  return {
    items: DEFAULT_CSC_CONTENT.map((item) => ({ ...item })),
    updatedAt: null,
  };
}

function blobToken() {
  return process.env.VERCEL_ENV === "production"
    ? process.env.BLOB_READ_WRITE_TOKEN
    : process.env.DINING_NONPROD_BLOB_READ_WRITE_TOKEN;
}

function readText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${field} must be ${maxLength} characters or fewer`);
  return text;
}

export function validateCscContent(input: unknown): CscContentItem[] {
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
  return items;
}

export async function getCscContent(): Promise<CscContentResponse> {
  const token = blobToken();
  if (!token) return defaultContent();
  const item = await get(CONTENT_PATH, { access: "private", useCache: false, token });
  if (!item) return defaultContent();
  if (item.statusCode !== 200 || !item.stream) throw new Error("Unable to read saved highlights");
  try {
    const stored = JSON.parse(await new Response(item.stream).text()) as CscContentResponse;
    return {
      items: validateCscContent(stored.items),
      updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : null,
    };
  } catch {
    throw new Error("Saved highlights are invalid");
  }
}

export async function updateCscContent(input: unknown): Promise<CscContentResponse> {
  const token = blobToken();
  if (!token) throw new Error("Highlight storage is not configured");
  const content = { items: validateCscContent(input), updatedAt: new Date().toISOString() };
  await put(CONTENT_PATH, JSON.stringify(content), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  return content;
}
