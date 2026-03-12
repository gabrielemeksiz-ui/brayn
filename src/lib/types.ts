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
  | 'outils';

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
};

export type NoteSource = 'telegram' | 'desktop';

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
  clean_other_language: string;
}

export interface IngestPayload {
  text: string;
  sentAt?: string;
  source?: NoteSource;
}