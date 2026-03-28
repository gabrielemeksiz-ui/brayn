-- Renommer "Étudiant en commerce" → "Étudiant"
UPDATE category_templates
SET profile_label = 'Étudiant'
WHERE id = 'etudiant_commerce';

-- Ajouter profil "Journal de vie"
INSERT INTO category_templates (id, profile_label, profile_emoji, interests, categories)
VALUES (
  'journal_vie',
  'Journal de vie',
  '🌸',
  ARRAY['écriture', 'souvenirs', 'bien-être', 'développement personnel'],
  '[
    {"id": "journal_intime", "label": "Journal intime", "emoji": "📖", "color": "#A855F7", "description": "Pensées du jour et réflexions perso", "ai_description": "Journal intime, émotions du jour, pensées personnelles, humeurs, introspection quotidienne, ce que je ressens"},
    {"id": "anecdotes", "label": "Anecdotes", "emoji": "😄", "color": "#F59E0B", "description": "Histoires et moments mémorables", "ai_description": "Petites histoires de la vie quotidienne, anecdotes marrantes ou touchantes, moments à ne pas oublier, souvenirs de conversations"},
    {"id": "souvenirs", "label": "Souvenirs", "emoji": "🌅", "color": "#F97316", "description": "Moments et memories à garder", "ai_description": "Souvenirs marquants, voyages, moments avec des proches, événements importants de ma vie, photos mentales à conserver"},
    {"id": "gratitude", "label": "Gratitude", "emoji": "🙏", "color": "#22C55E", "description": "Ce dont je suis reconnaissant", "ai_description": "Listes de gratitude, belles choses de la vie, petits bonheurs du quotidien, ce qui me rend heureux aujourd''hui"},
    {"id": "objectifs_reves", "label": "Objectifs & rêves", "emoji": "🎯", "color": "#3B82F6", "description": "Ce que je veux accomplir et rêver", "ai_description": "Objectifs personnels, rêves et aspirations, bucket list, choses à faire avant de mourir, projets de vie futurs"}
  ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  profile_label = EXCLUDED.profile_label,
  profile_emoji = EXCLUDED.profile_emoji,
  interests = EXCLUDED.interests,
  categories = EXCLUDED.categories;
