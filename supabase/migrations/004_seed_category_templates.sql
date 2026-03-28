INSERT INTO category_templates (id, profile_label, profile_emoji, interests, categories) VALUES

('etudiant_commerce', 'Étudiant', '🎓',
  ARRAY['finance', 'marketing', 'géopolitique', 'entrepreneuriat'],
  '[
    {"id": "business_project", "label": "Business / Projet", "emoji": "🚀", "color": "#3B82F6", "description": "Idées business et projets entrepreneuriaux", "ai_description": "Idées business, projets entrepreneuriaux, startups, business plans, modèles économiques, stratégies de lancement"},
    {"id": "finance", "label": "Finance", "emoji": "📊", "color": "#22C55E", "description": "Analyses financières et marchés", "ai_description": "Analyses financières, Excel, marchés financiers, bilans, ratios, valorisation, comptabilité (hors actions spécifiques à surveiller)"},
    {"id": "geopolitique", "label": "Géopolitique", "emoji": "🌍", "color": "#F97316", "description": "Actualités internationales et politique", "ai_description": "Actualités internationales, commerce mondial, politique étrangère, tensions diplomatiques, sanctions, accords commerciaux"},
    {"id": "cours_revisions", "label": "Cours & révisions", "emoji": "📚", "color": "#A855F7", "description": "Notes de cours et fiches de révision", "ai_description": "Notes de cours, résumés de chapitres, fiches de révision, points clés à retenir pour les examens"},
    {"id": "reseau_pro", "label": "Réseau pro", "emoji": "🤝", "color": "#06B6D4", "description": "Contacts, events, opportunités", "ai_description": "Contacts professionnels, événements networking, opportunités de stage/emploi, recommandations, mentorat"}
  ]'::jsonb
),

('entrepreneur', 'Entrepreneur', '💼',
  ARRAY['business', 'marketing', 'finance', 'tech'],
  '[
    {"id": "business_project", "label": "Projets", "emoji": "🚀", "color": "#3B82F6", "description": "Mes projets en cours", "ai_description": "Idées business, projets entrepreneuriaux, startups, pivots, business plans, stratégies de croissance"},
    {"id": "finance", "label": "Finance", "emoji": "📊", "color": "#22C55E", "description": "Trésorerie, levées, metrics", "ai_description": "Trésorerie, levée de fonds, KPIs, revenue, burn rate, P&L, valorisation, term sheets"},
    {"id": "outils", "label": "Outils & stack", "emoji": "🔧", "color": "#0EA5E9", "description": "Apps, SaaS, outils productivité", "ai_description": "Sites web, applications, logiciels, extensions, outils de productivité, SaaS, no-code, automatisations"},
    {"id": "marketing", "label": "Marketing", "emoji": "📣", "color": "#EC4899", "description": "Acquisition, branding, contenu", "ai_description": "Stratégies marketing, acquisition clients, branding, content marketing, SEO, publicité, growth hacking"},
    {"id": "clients", "label": "Clients & feedback", "emoji": "💬", "color": "#F59E0B", "description": "Retours clients et insights", "ai_description": "Feedback clients, feature requests, pain points utilisateurs, témoignages, études de marché"}
  ]'::jsonb
),

('investisseur', 'Investisseur', '📈',
  ARRAY['finance', 'crypto', 'géopolitique', 'macro'],
  '[
    {"id": "stocks_watchlist", "label": "Watchlist", "emoji": "📋", "color": "#06B6D4", "description": "Actions et secteurs à surveiller", "ai_description": "Actions spécifiques à surveiller, secteurs financiers, ETFs, alertes de prix, earnings à venir"},
    {"id": "finance", "label": "Analyse financière", "emoji": "📊", "color": "#22C55E", "description": "Analyses, ratios, bilans", "ai_description": "Analyses financières détaillées, bilans, ratios, valorisation, modèles DCF, comparables sectoriels"},
    {"id": "crypto_web3", "label": "Crypto / Web3", "emoji": "⛓️", "color": "#8B5CF6", "description": "Blockchain, DeFi, altcoins", "ai_description": "Blockchain, cryptomonnaies, DeFi, Web3, NFTs, protocoles, tokenomics, yield farming, airdrops"},
    {"id": "geopolitique", "label": "Géopolitique", "emoji": "🌍", "color": "#F97316", "description": "Impact géopo sur les marchés", "ai_description": "Actualités internationales impactant les marchés, guerres commerciales, sanctions, politique monétaire des banques centrales"},
    {"id": "macro_economie", "label": "Macro-économie", "emoji": "🏦", "color": "#EF4444", "description": "Taux, inflation, cycles", "ai_description": "Indicateurs macroéconomiques, taux directeurs, inflation, PIB, emploi, cycles économiques, politique monétaire"}
  ]'::jsonb
),

('tech_dev', 'Tech / Dev', '💻',
  ARRAY['code', 'ia', 'outils', 'veille'],
  '[
    {"id": "outils", "label": "Outils & stack", "emoji": "🔧", "color": "#0EA5E9", "description": "Apps, librairies, extensions", "ai_description": "Sites web, applications, logiciels, extensions, frameworks, librairies, CLI tools, outils de productivité dev"},
    {"id": "interesting_topic", "label": "Veille tech", "emoji": "🔍", "color": "#10B981", "description": "Sujets à explorer", "ai_description": "Sujets techniques à approfondir, articles intéressants, nouvelles technos, papers de recherche, tendances"},
    {"id": "side_projects", "label": "Side projects", "emoji": "⚡", "color": "#F59E0B", "description": "Projets perso et expérimentations", "ai_description": "Projets personnels, expérimentations, prototypes, idées à coder, hackathons, contributions open source"},
    {"id": "bugs_fixes", "label": "Bugs & solutions", "emoji": "🐛", "color": "#EF4444", "description": "Problèmes résolus, snippets", "ai_description": "Bugs rencontrés et solutions, snippets de code utiles, workarounds, configurations, debug logs, Stack Overflow bookmarks"},
    {"id": "ia_ml", "label": "IA / ML", "emoji": "🤖", "color": "#8B5CF6", "description": "Intelligence artificielle, modèles", "ai_description": "Intelligence artificielle, machine learning, LLMs, prompting, fine-tuning, RAG, agents, papers IA"}
  ]'::jsonb
),

('creatif', 'Créatif', '🎨',
  ARRAY['art', 'musique', 'design', 'inspiration'],
  '[
    {"id": "inspiration", "label": "Inspiration", "emoji": "✨", "color": "#F59E0B", "description": "Références visuelles et idées", "ai_description": "Références visuelles, moodboards, idées créatives, citations inspirantes, concepts artistiques à explorer"},
    {"id": "personal_reflection", "label": "Journal", "emoji": "📝", "color": "#A855F7", "description": "Pensées et réflexions perso", "ai_description": "Journal intime, sentiments, pensées personnelles, introspection, gratitude, objectifs personnels"},
    {"id": "interesting_topic", "label": "À explorer", "emoji": "🔍", "color": "#10B981", "description": "Sujets et rabbit holes", "ai_description": "Sujets à approfondir, rabbit holes intéressants, documentaires à voir, livres à lire, artistes à découvrir"},
    {"id": "projets_creatifs", "label": "Projets créatifs", "emoji": "🎬", "color": "#3B82F6", "description": "Mes créations en cours", "ai_description": "Projets créatifs en cours ou en idée : vidéos, musique, design, écriture, photo, illustration, podcasts"},
    {"id": "references", "label": "Références", "emoji": "📂", "color": "#6B7280", "description": "Assets, links, ressources", "ai_description": "Liens utiles, assets graphiques, palettes de couleurs, polices, templates, tutoriels, outils créatifs"}
  ]'::jsonb
)

ON CONFLICT (id) DO NOTHING;
