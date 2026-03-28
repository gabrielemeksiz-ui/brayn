export type NoteCategory = string;

export interface Category {
  id: string;
  label: string;
  description: string;
  ai_description: string;
  emoji: string;
  color: string;
  sort_order: number;
  is_builtin: boolean;
  hidden: boolean;
  user_id?: string;
}

export type NoteSource = 'telegram' | 'desktop' | 'youtube';

export interface Note {
  id: string;
  created_at: string;
  updated_at: string;
  source: NoteSource;
  seen: boolean;
  categories: NoteCategory[];
  tags: string[];
  links: string[];
  original_text: string;
  clean_original_language: string | null;
  content_json?: unknown;
  full_text?: string | null;
  user_id?: string;
  ai_status: 'pending' | 'processing' | 'done' | 'failed';
}

export interface UserProfile {
  user_id: string;
  is_admin: boolean;
  created_at: string;
  onboarding_completed: boolean;
}

export interface AIClassificationResponse {
  categories: NoteCategory[];
}

export interface AIRewriteResponse {
  clean_original_language: string;
}

export interface AISummaryResponse {
  summary: string;
}

export interface IngestPayload {
  text: string;
  sentAt?: string;
  source?: NoteSource;
}
