export type NoteCategory =
  | 'business_project'
  | 'personal_reflection'
  | 'interesting_topic'
  | 'conspiracy_theory'
  | 'stocks_watchlist'
  | 'need'
  | 'finance'
  | 'géopolitique'
  | 'Crypto-Web3'
  | 'outils'
  | 'twitter'
  | 'youtube';

export const ALL_CATEGORIES: NoteCategory[] = [
  'business_project',
  'personal_reflection',
  'interesting_topic',
  'conspiracy_theory',
  'stocks_watchlist',
  'need',
  'finance',
  'géopolitique',
  'Crypto-Web3',
  'outils',
  'twitter',
  'youtube',
];

export const CATEGORY_LABELS: Record<NoteCategory, string> = {
  business_project: 'Business / Projet',
  personal_reflection: 'Réflexion perso',
  interesting_topic: 'Sujet intéressant',
  conspiracy_theory: 'Théorie',
  stocks_watchlist: 'Watchlist',
  need: 'Need',
  finance: 'Finance',
  géopolitique: 'Géopolitique',
  'Crypto-Web3': 'Crypto / Web3',
  outils: 'Outils',
  twitter: 'Twitter',
  youtube: 'YouTube',
};

export const CATEGORY_COLORS: Record<NoteCategory, string> = {
  business_project: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  personal_reflection: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  interesting_topic: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  conspiracy_theory: 'bg-red-500/20 text-red-300 border-red-500/30',
  stocks_watchlist: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  need: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  finance: 'bg-green-500/20 text-green-300 border-green-500/30',
  géopolitique: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Crypto-Web3': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  outils: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  twitter: 'bg-[#1D9BF0]/15 text-[#1D9BF0] border-[#1D9BF0]/30',
  youtube: 'bg-[#FF0000]/15 text-[#FF4444] border-[#FF0000]/30',
};

// Outline only — bordure colorée sans fond
export const CATEGORY_OUTLINE: Record<NoteCategory, string> = {
  business_project: 'border-blue-500/50 text-blue-300',
  personal_reflection: 'border-purple-500/50 text-purple-300',
  interesting_topic: 'border-emerald-500/50 text-emerald-300',
  conspiracy_theory: 'border-red-500/50 text-red-300',
  stocks_watchlist: 'border-cyan-500/50 text-cyan-300',
  need: 'border-pink-500/50 text-pink-300',
  finance: 'border-green-500/50 text-green-300',
  géopolitique: 'border-orange-500/50 text-orange-300',
  'Crypto-Web3': 'border-violet-500/50 text-violet-300',
  outils: 'border-sky-500/50 text-sky-300',
  twitter: 'border-[#1D9BF0]/50 text-[#1D9BF0]',
  youtube: 'border-[#FF0000]/50 text-[#FF4444]',
};

// Dot color for sidebar indicator
export const CATEGORY_DOT: Record<NoteCategory, string> = {
  business_project: 'bg-blue-400',
  personal_reflection: 'bg-purple-400',
  interesting_topic: 'bg-emerald-400',
  conspiracy_theory: 'bg-red-400',
  stocks_watchlist: 'bg-cyan-400',
  need: 'bg-pink-400',
  finance: 'bg-green-400',
  géopolitique: 'bg-orange-400',
  'Crypto-Web3': 'bg-violet-400',
  outils: 'bg-sky-400',
  twitter: 'bg-[#1D9BF0]',
  youtube: 'bg-[#FF0000]',
};

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
    clean_other_language: string | null;
    content_json?: any; // <-- pour BlockNote
    full_text?: string | null;
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