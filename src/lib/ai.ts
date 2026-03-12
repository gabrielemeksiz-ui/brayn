import OpenAI from 'openai';
import type { AIClassificationResponse, AIRewriteResponse, NoteCategory } from './types';
import { ALL_CATEGORIES } from './types';

const client = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

function parseJSON<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as T;
}

export async function classifyNote(
  originalText: string,
  customCategories: { id: string; label: string; description: string }[] = [],
): Promise<AIClassificationResponse> {
  const customCatLines = customCategories.length > 0
    ? '\nCatégories personnalisées supplémentaires :\n' +
      customCategories.map(c => `- ${c.id} : ${c.description || c.label}`).join('\n')
    : '';

  const allCategoryIds = [...ALL_CATEGORIES, ...customCategories.map(c => c.id)];

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `Tu es le classificateur IA de Brayn, app de prise de notes intelligente. Analyse la note et assigne 1 à 3 catégories parmi la liste stricte ci-dessous. Ne crée JAMAIS de nouvelles catégories.

Catégories autorisées (exactement ces 10) :
- business_project : idées business, projets entrepreneuriaux, startups
- personal_reflection : journal intime, sentiments, pensées personnelles à garder
- interesting_topic : sujets à approfondir/rechercher plus tard
- conspiracy_theory : théories du complot, infos douteuses/non vérifiées
- stocks_watchlist : actions à surveiller, secteurs financiers spécifiques
- need : wishlist achats, objets à acheter, besoins matériels
- finance : analyses financières, Excel, marchés (hors actions spécifiques)
- géopolitique : actualités internationales, commerce mondial, politique
- Crypto-Web3 : blockchain, cryptomonnaies, DeFi, Web3, NFTs
- outils : sites web, apps, logiciels, extensions, outils productivité${customCatLines}

Règles :
1. Cherche d'abord L'INTENTION FINALE de la note : quel est le vrai message, la conclusion, la préoccupation centrale ?
2. Ne te laisse pas piéger par les mots-clés de surface. Les sujets mentionnés en passant ne sont pas forcément la catégorie
3. Demande-toi : "pourquoi l'auteur a écrit cette note ? qu'est-ce qu'il veut retenir ?"
4. Assigne 1 catégorie si l'intention est claire. 2-3 seulement si la note exprime vraiment plusieurs intentions distinctes
5. "need" = SEULEMENT si c'est une liste d'achats/envies matérielles
6. "stocks_watchlist" = SEULEMENT actions/secteurs précis à surveiller
7. "Crypto-Web3" = SEULEMENT si la note parle DE crypto/web3 comme sujet principal, pas si crypto/web3 est juste un exemple

Exemples :
"Idée SaaS pour étudiants SKEMA, abo 9,99€/mois" → ["business_project"]
"Ce soir triste, envie de techno mais pas motivé" → ["personal_reflection"]
"Lu article IA quantique, à creuser" → ["interesting_topic"]
"Vaccins + 5G = contrôle mondial" → ["conspiracy_theory"]
"Nvidia + semi-conducteurs à surveiller" → ["stocks_watchlist"]
"Besoin AirPods Pro + hoodie Margiela" → ["need"]
"Analyse bilan Apple Q4 + ratios" → ["finance"]
"Tensions Taïwan-Chine impactant puces" → ["géopolitique"]
"Solana vs Ethereum gas fees" → ["Crypto-Web3"]
"Cursor AI > VSCode, à tester" → ["outils"]
"Idée app crypto pour surveiller les altcoins à fort potentiel" → ["business_project", "Crypto-Web3"]
"Tensions géopo + impact sur Bitcoin et les marchés" → ["géopolitique", "Crypto-Web3", "finance"]
"tout ce qui existe en data IA telephone internet va devenir en web3 en chain tout va être fliqué" → ["interesting_topic", "conspiracy_theory"] (intention = surveillance généralisée, web3/chain sont juste les moyens mentionnés, pas le sujet)

Note à classer :
${originalText}

SORTIE JSON STRICT (rien d'autre) :
{"categories": ["cat1", "cat2"], "confiance": 10, "explication": "1 phrase"}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '';
  const raw = parseJSON<{ categories: string[]; confiance: number; explication: string }>(text);

  const categories = (raw.categories ?? []).filter((c): c is NoteCategory =>
    allCategoryIds.includes(c as NoteCategory)
  );

  return { categories };
}

export async function rewriteNote(originalText: string): Promise<AIRewriteResponse> {
  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Tu es un assistant d'écriture. Pour ce texte :
1. Détecte la langue principale (FR ou EN).
2. Écris une version propre, concise et corrigée dans cette même langue (clean_original_language).
3. Traduis fidèlement dans l'autre langue (clean_other_language).
Ne rajoute aucune idée. Corrige l'orthographe, grammaire, ponctuation.

Réponds UNIQUEMENT avec du JSON valide :
{"clean_original_language": "...", "clean_other_language": "..."}

Texte :
${originalText}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '';
  return parseJSON<AIRewriteResponse>(text);
}