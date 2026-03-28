-- Mapping des catégories existantes de l'admin avec emoji + couleur
-- À exécuter APRÈS la migration 003 dans Supabase SQL Editor

UPDATE categories SET emoji = '🚀', color = '#3B82F6', sort_order = 0,
  ai_description = 'Idées business, projets entrepreneuriaux, startups, business plans, modèles économiques'
  WHERE id = 'business_project';

UPDATE categories SET emoji = '📝', color = '#A855F7', sort_order = 1,
  ai_description = 'Journal intime, sentiments, pensées personnelles, introspection'
  WHERE id = 'personal_reflection';

UPDATE categories SET emoji = '🔍', color = '#10B981', sort_order = 2,
  ai_description = 'Sujets à approfondir ou rechercher plus tard, articles intéressants'
  WHERE id = 'interesting_topic';

UPDATE categories SET emoji = '🕵️', color = '#EF4444', sort_order = 3,
  ai_description = 'Théories du complot, informations douteuses ou non vérifiées'
  WHERE id = 'conspiracy_theory';

UPDATE categories SET emoji = '📋', color = '#06B6D4', sort_order = 4,
  ai_description = 'Actions spécifiques à surveiller, secteurs financiers, ETFs'
  WHERE id = 'stocks_watchlist';

UPDATE categories SET emoji = '🛒', color = '#EC4899', sort_order = 5,
  ai_description = 'Wishlist achats, objets à acheter, besoins matériels'
  WHERE id = 'need';

UPDATE categories SET emoji = '📊', color = '#22C55E', sort_order = 6,
  ai_description = 'Analyses financières, Excel, marchés financiers, bilans, ratios (hors actions spécifiques)'
  WHERE id = 'finance';

UPDATE categories SET emoji = '🌍', color = '#F97316', sort_order = 7,
  ai_description = 'Actualités internationales, commerce mondial, politique étrangère, tensions diplomatiques'
  WHERE id = 'géopolitique';

UPDATE categories SET emoji = '⛓️', color = '#8B5CF6', sort_order = 8,
  ai_description = 'Blockchain, cryptomonnaies, DeFi, Web3, NFTs, protocoles, tokenomics'
  WHERE id = 'Crypto-Web3';

UPDATE categories SET emoji = '🔧', color = '#0EA5E9', sort_order = 9,
  ai_description = 'Sites web, applications, logiciels, extensions, outils de productivité'
  WHERE id = 'outils';

UPDATE categories SET emoji = '🐦', color = '#1D9BF0', sort_order = 10,
  ai_description = 'Notes importées automatiquement depuis Twitter/X (auto-tag)'
  WHERE id = 'twitter';

UPDATE categories SET emoji = '▶️', color = '#FF0000', sort_order = 11,
  ai_description = 'Vidéos YouTube importées et résumées (auto-tag)'
  WHERE id = 'youtube';

-- Marquer l'admin comme onboarding terminé
UPDATE user_profiles SET onboarding_completed = true WHERE is_admin = true;
