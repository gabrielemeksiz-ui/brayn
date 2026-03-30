# Spec : Redesign UI Brayn — Nocturnal Minimalist

**Date :** 2026-03-30
**Référence design :** `/Users/gabrielemeksiz/stitch/` + `DESIGN.md`
**Scope :** UI uniquement — aucun changement backend, logique, routes API, ou interfaces TypeScript

---

## 1. Design System (source : DESIGN.md)

### Palette de couleurs
| Token | Valeur | Usage |
|-------|--------|-------|
| `surface` | `#131315` | Fond principal (main area) |
| `surface-container-low` | `#1b1b1d` | Sidebar |
| `surface-container` | `#1f1f21` | Cards en état normal |
| `surface-container-high` | `#2a2a2c` | Cards au hover |
| `surface-container-highest` | `#353437` | États actifs, éléments flottants |
| `primary` | `#ffcbd0` | Accent rose — actions, éléments actifs |
| `primary-container` | `#fda4af` | Dégradé CTA |
| `on-surface` | `#e4e2e4` | Texte principal |
| `on-surface-variant` | `#d8c1c3` | Texte secondaire |
| `outline-variant` | `#534344` | Bordures "ghost" (15% opacity max) |

**Règle "No-Line" :** aucune `border` de 1px pour séparer des sections. Les frontières sont définies par les décalages de fond (`surface` vs `surface-container-low`). Exception autorisée : `border-l-2 border-[#ffcbd0]` pour l'état actif en sidebar.

### Typographie
- Font exclusive : **Inter**
- Headers grands : `font-extrabold tracking-tighter` (ex: titre de note)
- Labels métadonnées : `text-[10px] uppercase tracking-widest text-on-surface-variant/40`
- Corps : `text-sm leading-relaxed`
- Pas d'emojis

### Icônes
Remplacer tous les SVG inline par **Material Symbols Outlined** (déjà dans les exports Stitch).
Font à ajouter dans `layout.tsx` :
```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
```
Classe CSS : `material-symbols-outlined` avec `font-variation-settings: 'FILL' 0, 'wght' 300`

### Élévation & Profondeur
- Shadowless par défaut
- Floating elements (dropdowns, chat input) : `box-shadow: 0px 20px 40px rgba(0,0,0,0.4)`
- Top bar + chat panel : `backdrop-filter: blur(12px)` + `bg-[#131315]/80`

### Scrollbar custom (globals.css)
```css
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #353437; border-radius: 10px; }
```

---

## 2. Layout Global (`src/app/layout.tsx`)

Ajouter la font Material Symbols dans le `<head>`. Garder Inter existant.

---

## 3. Sidebar (`src/app/page.tsx` — bloc `<aside>`)

### Structure
```
Sidebar (w-64, bg-[#1b1b1d], pas de border-r)
  ├── Header
  │     ├── Logo (icône terminal + "Brayn" bold tracking-tighter)
  │     └── Bouton "Nouvelle Note" (gradient primary→primary-container)
  ├── Nav principale
  │     ├── "NAVIGATION" label (uppercase 10px tracking-widest)
  │     ├── Nouveaux (avec badge count rose)
  │     ├── Tous
  │     └── Par Catégorie (filtre)
  ├── Section "FICHIERS" (label uppercase)
  │     └── Catégories — style explorateur Obsidian :
  │           • Fermé : chevron_right + folder icon + label + count
  │           • Ouvert : expand_more + folder_open + label
  │                └── notes indentées (border-l border-outline-variant/20 ml-2)
  └── Footer (mt-auto)
        ├── Catégories (section settings, icône tune)
        ├── Compte (lien /settings, icône person)
        └── Déconnexion (icône logout, ml-auto)
```

### État actif
- Item nav actif : `border-l-2 border-[#ffcbd0] text-[#ffcbd0] font-semibold pl-4`
- Item nav inactif : `text-[#e4e2e4]/60 hover:text-[#e4e2e4] hover:bg-[#353437]/50 pl-4`
- Catégorie active : `text-primary font-semibold` + `folder_open`
- Note sélectionnée dans l'arbre : `text-primary font-medium`

### Drag & Drop
Conserver la logique existante de drag & drop entre catégories. Seul le style visuel change (highlight `bg-primary/10` au lieu de `bg-[#2E7CD1]/10`).

### Action menu (+ Nouvelle Note)
Conserver le dropdown existant. Restyler : `bg-surface-container`, `rounded-xl`, shadow diffuse, sans `border`.

---

## 4. Zone principale — barre de recherche & filtres (`src/app/page.tsx`)

La barre de recherche reste dans le panneau central (pas déplacée dans un top nav global).

Style :
- Input : `bg-surface-container-lowest border-none rounded-lg pl-10 pr-4 py-2 text-xs focus:ring-1 focus:ring-primary/40 placeholder:text-on-surface-variant/30`
- Icône search : Material Symbols `search`
- Filtres catégories (chips) : `bg-surface-container-highest text-on-surface-variant text-[10px] font-bold uppercase rounded px-2 py-0.5` — sans couleur custom, actif avec `border border-primary/30 text-primary`
- Select période : intégré au même style que l'input

---

## 5. Liste de notes (`src/components/NoteList.tsx`)

### Carte de note
```
Pas de border
Padding: p-6
Fond repos: transparent
Fond hover: bg-surface-container-low (tonal, pas de border)
Border-radius: rounded-xl
```

Structure interne :
```
├── Titre (text-lg font-semibold text-on-surface, hover:text-primary)
├── Snippet (text-sm text-on-surface-variant line-clamp-1) — afficher clean_original_language si dispo
├── Métadonnées (flex gap-4 mt-3)
│     ├── Date : calendar_today icon + "14 OCTOBRE 2023" (11px uppercase tracking-wider)
│     └── Catégories : badge surface-container-highest, texte on-surface-variant, uppercase 10px
└── Indicateur "Nouveau" : text-primary font-semibold (remplace le bleu)
```

### Toolbar sélection
Conserver la logique. Restyler le bouton "Sélectionner" et "Supprimer" avec les tokens du design system.

### État vide
Texte centré `text-on-surface-variant/40 text-sm`.

---

## 6. Détail de note (`src/components/NoteDetail.tsx`)

### Header de note
- Métadonnées source/date : `bg-surface-container-high text-on-surface-variant/60 text-[10px] tracking-widest uppercase px-2 py-1 rounded`
- Titre : `text-4xl font-extrabold tracking-tighter text-on-surface` (cliquable pour édition)
- Séparateur : supprimer la `border-b border-[#2A2A2A]`, utiliser `mt-8` à la place
- Boutons actions (Chat IA, Classer, Supprimer, Fermer) : restyler avec les tokens. Chat IA actif : `bg-primary/10 text-primary border border-primary/20`

### Catégories inline
- Badge : `bg-surface-container-highest text-on-surface-variant text-xs uppercase rounded px-2 py-0.5`
- Bouton retrait : petit `×` en `text-on-surface-variant/50`
- Select "Ajouter catégorie" : `bg-surface-container-lowest border-none rounded-lg text-xs`

### Chat IA panel (drawer bas)
```
Hauteur: h-80
Background: bg-[#131315]/80 backdrop-blur-xl
Border-top: border-t border-outline-variant/15
```

Header du panel :
```
├── Point lumineux : w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(255,203,208,0.5)]
├── Label : "ASSISTANT IA BRAYN" uppercase tracking-widest text-primary text-xs font-bold
└── Boutons : expand (open_in_full) + fermer (keyboard_arrow_down)
```

Messages IA :
- Avatar IA : `w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-container` + icône `auto_awesome`
- Bulle IA : `bg-surface-container-high/50 p-4 rounded-2xl rounded-tl-none text-sm`
- Avatar user : `w-8 h-8 rounded-lg bg-surface-container-highest`
- Bulle user : `bg-primary/10 p-4 rounded-2xl rounded-tr-none border border-primary/10`
- Timestamp : `text-[10px] text-on-surface-variant/30 uppercase tracking-widest`

Loading indicator : 3 dots `bg-primary/40` animate-bounce.

Input zone :
```
bg-surface-container-high/60 backdrop-blur-xl p-2 rounded-2xl
border border-outline-variant/10
shadow-[0px_20px_40px_rgba(0,0,0,0.4)]
```
Bouton send : `bg-primary text-on-primary rounded-xl` + icône `send` Material Symbols.

---

## 7. Styles globaux (`src/app/globals.css`)

Ajouter :
```css
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20;
  font-size: 20px;
}
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #353437; border-radius: 10px; }
```

---

## 8. Fichiers modifiés (résumé)

| Fichier | Type de changement |
|---------|-------------------|
| `src/app/layout.tsx` | Ajout font Material Symbols |
| `src/app/globals.css` | Scrollbar + classe material-symbols |
| `src/app/page.tsx` | Sidebar complète + zone recherche |
| `src/components/NoteList.tsx` | Cartes redessinées |
| `src/components/NoteDetail.tsx` | Header + chat panel |

**Non modifiés :** `NoteEditor.tsx`, `TweetEmbed.tsx`, `CategorySettings.tsx`, toutes les routes API, `middleware.ts`, pages `login`, `signup`, `onboarding`, `settings`.

---

## 9. Tests manuels post-déploiement

- [ ] Sidebar : catégories s'ouvrent/ferment avec l'icône chevron + folder
- [ ] Sidebar : notes s'affichent en arbre indenté sous la catégorie ouverte
- [ ] Sidebar : item actif affiche bien le `border-l-2` rose
- [ ] Drag & drop d'une note vers une autre catégorie fonctionne
- [ ] Badge "Nouveaux" s'affiche et se met à jour
- [ ] Chat IA : s'ouvre en panel bas, messages s'affichent correctement
- [ ] Chat IA : l'envoi de message fonctionne, le loading s'affiche
- [ ] Recherche filtre bien les notes
- [ ] Chips catégories filtrent la liste
- [ ] Note éditable au clic sur le titre
- [ ] Auto-save de l'éditeur fonctionne (vérifier 2s)
- [ ] Bouton "Nouvelle Note" crée une note et l'ouvre
- [ ] Logout fonctionne
