# UI Redesign Brayn — Nocturnal Minimalist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appliquer le design system "Nocturnal Minimalist" (Stitch) sur les 5 fichiers UI de Brayn sans toucher au backend ni à la logique.

**Architecture:** Changements purement visuels — remplacement des tokens de couleur (`#191919`/bleu → `#131315`/rose), ajout des icônes Material Symbols, refonte de la sidebar en style explorateur Obsidian avec dossiers expandables.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Material Symbols Outlined

**Spec de référence:** `docs/superpowers/specs/2026-03-30-ui-redesign-stitch.md`

> **Note TDD:** Ce plan est purement UI. Il n'y a pas de logique testable unitairement. La vérification se fait via `npm run build` (zéro erreur TypeScript/lint) après chaque tâche, et par tests manuels en fin de plan.

---

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/app/layout.tsx` | Ajout font Material Symbols |
| `src/app/globals.css` | Scrollbar fine + classe material-symbols-outlined |
| `src/app/page.tsx` | Sidebar complète + search bar + chips |
| `src/components/NoteList.tsx` | Cartes sans border, tonal hover, snippets |
| `src/components/NoteDetail.tsx` | Header + actions + chat panel glassmorphism |

---

## Task 1 : Foundation — Font + CSS globaux

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1 : Ajouter Material Symbols dans layout.tsx**

Remplacer le contenu de `src/app/layout.tsx` par :

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Brayn — Mon second cerveau',
  description: 'Capture, organise et exploite tes idées.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#131315] text-[#e4e2e4] antialiased font-sans">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2 : Mettre à jour globals.css**

Remplacer le contenu de `src/app/globals.css` par :

```css
@import "tailwindcss";

:root {
  --font-inter: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

@theme inline {
  --font-sans: var(--font-inter);
}

* {
  box-sizing: border-box;
}

body {
  background: #131315;
  color: #e4e2e4;
  font-family: var(--font-inter);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20;
  font-size: 20px;
  line-height: 1;
  vertical-align: middle;
}

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #353437; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #4a4a4c; }

option {
  background: #1f1f21;
  color: #e4e2e4;
}
```

- [ ] **Step 3 : Vérifier le build**

```bash
cd /Users/gabrielemeksiz/brayn-main && npm run build
```

Résultat attendu : `✓ Compiled successfully` sans erreurs TypeScript.

- [ ] **Step 4 : Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: add Material Symbols font + update global CSS tokens"
```

---

## Task 2 : Sidebar — Header + Navigation principale (page.tsx)

**Files:**
- Modify: `src/app/page.tsx`

Cette tâche remplace le bloc `<aside>` jusqu'à la fin de la section "Nav section" (lignes ~296–427).

- [ ] **Step 1 : Remplacer la fonction `sidebarItem` et l'ouverture de l'aside**

Trouver et remplacer la fonction `sidebarItem` (lignes 272–289) et le début de l'aside (ligne 296) :

**Ancienne fonction `sidebarItem` (supprimer complètement) :**
```tsx
  const sidebarItem = (label: string, value: Section, badge?: number) => (
    <button
      key={value}
      onClick={() => { setSection(value); setSelected(null); }}
      className={`w-full text-left px-2 py-[5px] rounded-[4px] text-[14px] transition-colors duration-100 flex items-center justify-between
        ${section === value
          ? 'bg-[#2E7CD1]/15 text-[#2E7CD1]'
          : 'text-[#9B9B9B] hover:text-[#D4D4D4] hover:bg-[#2A2A2A]'
        }`}
    >
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-[#2E7CD1] text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );
```

Remplacer par une helper inline (à coller à la même place) :

```tsx
  const sidebarNavItem = (label: string, value: Section, icon: string) => {
    const isActive = section === value;
    return (
      <button
        key={value}
        onClick={() => { setSection(value); setSelected(null); }}
        className={`w-full text-left flex items-center gap-3 py-2 text-sm font-medium transition-colors duration-150 rounded-lg
          ${isActive
            ? 'border-l-2 border-[#ffcbd0] pl-3 text-[#ffcbd0] font-semibold'
            : 'pl-4 text-[#e4e2e4]/60 hover:text-[#e4e2e4] hover:bg-[#353437]/50'
          }`}
      >
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
        <span>{label}</span>
      </button>
    );
  };
```

- [ ] **Step 2 : Remplacer le bloc `<aside>` entier**

Localiser l'ouverture `{/* Sidebar */}` jusqu'à `</aside>` (~lignes 295–584) et remplacer par :

```tsx
      {/* Sidebar */}
      <aside className="w-64 bg-[#1b1b1d] flex flex-col shrink-0 overflow-y-auto">

        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ffcbd0] to-[#fda4af] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#571c27] text-[16px]">terminal</span>
            </div>
            <span className="text-[15px] font-bold tracking-tighter text-[#e4e2e4]">Brayn</span>
          </div>

          <div className="relative" ref={actionMenuRef}>
            <button
              onClick={() => setShowActionMenu(!showActionMenu)}
              className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-br from-[#ffcbd0] to-[#fda4af] text-[#571c27] font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all duration-150"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Nouvelle Note
            </button>

            {showActionMenu && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-[#1f1f21] rounded-xl shadow-[0px_20px_40px_rgba(0,0,0,0.4)] overflow-hidden z-50 border border-[#534344]/15">
                <button
                  onClick={() => { createEmptyNote(); setShowActionMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-[#e4e2e4]/80 hover:text-[#e4e2e4] hover:bg-[#353437]/50 transition-colors whitespace-nowrap flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-[16px]">add_notes</span>
                  Créer une note
                </button>
                <button
                  onClick={() => { setShowActionMenu(false); setSection('settings'); setSelected(null); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-[#e4e2e4]/80 hover:text-[#e4e2e4] hover:bg-[#353437]/50 transition-colors whitespace-nowrap flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                  Gérer les catégories
                </button>
                {isAdmin && (
                  <button
                    onClick={syncYoutube}
                    disabled={youtubeSyncing}
                    className="w-full text-left px-4 py-2.5 text-sm text-[#e4e2e4]/80 hover:text-[#e4e2e4] hover:bg-[#353437]/50 transition-colors whitespace-nowrap flex items-center gap-3 disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[16px]">sync</span>
                    {youtubeSyncing ? 'Sync en cours…' : 'Sync YouTube'}
                  </button>
                )}
              </div>
            )}
          </div>

          {youtubeSyncResult && (
            <p className="text-[11px] text-[#e4e2e4]/40 mt-2 px-1">{youtubeSyncResult}</p>
          )}
        </div>

        {/* Navigation principale */}
        <nav className="px-2 pb-2">
          <p className="text-[10px] uppercase tracking-widest text-[#e4e2e4]/30 font-bold px-3 pt-1 pb-2">Navigation</p>

          {/* Nouveaux — avec expand inline */}
          <div>
            <button
              onClick={() => { setExpandNewSection(!expandNewSection); setSection('new'); setSelected(null); }}
              className={`w-full text-left flex items-center gap-3 py-2 text-sm font-medium transition-colors duration-150 rounded-lg
                ${section === 'new'
                  ? 'border-l-2 border-[#ffcbd0] pl-3 text-[#ffcbd0] font-semibold'
                  : 'pl-4 text-[#e4e2e4]/60 hover:text-[#e4e2e4] hover:bg-[#353437]/50'
                }`}
            >
              <span className="material-symbols-outlined text-[18px]">add_notes</span>
              <span className="flex-1">Nouveaux</span>
              {newCount > 0 && (
                <span className="bg-[#ffcbd0] text-[#571c27] text-[9px] px-1.5 py-0.5 rounded-full font-bold tabular-nums mr-1">
                  {newCount}
                </span>
              )}
              <span className={`material-symbols-outlined text-[14px] text-[#e4e2e4]/30 mr-1 transition-transform duration-150 ${expandNewSection ? 'rotate-90' : ''}`}>
                chevron_right
              </span>
            </button>

            {expandNewSection && (
              <div className="pl-6 ml-2 border-l border-[#534344]/20 space-y-0.5 mt-0.5 max-h-48 overflow-y-auto">
                {getNewNotes().length === 0 ? (
                  <p className="text-[11px] text-[#e4e2e4]/30 py-1.5 px-2">Aucune note</p>
                ) : (
                  getNewNotes().map(note => (
                    <button
                      key={note.id}
                      onClick={() => { setSection('new'); openNote(note); }}
                      className={`w-full text-left px-2 py-1 rounded text-xs transition-colors duration-100 truncate
                        ${selected?.id === note.id
                          ? 'text-[#ffcbd0] font-medium'
                          : 'text-[#e4e2e4]/50 hover:text-[#e4e2e4]'
                        }`}
                    >
                      {noteTitle(note)}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {sidebarNavItem('Tous', 'all', 'docs')}
        </nav>

        {/* Catégories — style explorateur Obsidian */}
        <div className="px-2 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-[#e4e2e4]/30 font-bold px-3 pt-2 pb-2">Fichiers</p>

          {categories.map(cat => {
            const isExpanded = expandedCategories.has(cat.id);
            const categoryNotes = getCategoryNotes(cat.id);
            const isEditing = editingCatId === cat.id;
            const color = getCatColor(cat.id);

            const handleSave = async () => {
              if (!editingCatName.trim()) return;
              await fetch(`/api/categories/${cat.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: editingCatName }),
              });
              await refetchCategories();
              setEditingCatId(null);
            };

            const handleDelete = async () => {
              await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
              await refetchCategories();
            };

            return (
              <div key={cat.id}>
                {isEditing ? (
                  <div className="space-y-1.5 px-2 py-1.5">
                    <input
                      type="text"
                      value={editingCatName}
                      onChange={e => setEditingCatName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                      className="w-full bg-[#0e0e10] border-none rounded-lg px-3 py-1.5 text-sm text-[#e4e2e4] focus:outline-none focus:ring-1 focus:ring-[#ffcbd0]/40"
                      autoFocus
                    />
                    <div className="flex gap-1.5">
                      <button onClick={handleSave} className="flex-1 bg-gradient-to-br from-[#ffcbd0] to-[#fda4af] text-[#571c27] text-xs py-1.5 rounded-lg font-semibold">
                        Sauvegarder
                      </button>
                      <button onClick={() => setEditingCatId(null)} className="flex-1 bg-[#353437]/50 text-[#e4e2e4]/60 text-xs py-1.5 rounded-lg">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`group flex items-center rounded-lg transition-colors duration-150 ${
                      dragOverCat === cat.id && draggedNote && dragSourceCat !== cat.id
                        ? 'bg-[#ffcbd0]/10'
                        : 'hover:bg-[#353437]/50'
                    }`}
                    onDragOver={e => { e.preventDefault(); setDragOverCat(cat.id); }}
                    onDragLeave={() => setDragOverCat(null)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOverCat(null);
                      if (!draggedNote || dragSourceCat === cat.id) return;
                      const newCats = (draggedNote.categories as string[]).filter(c => c !== dragSourceCat);
                      if (!newCats.includes(cat.id)) newCats.push(cat.id);
                      updateNoteCategories(draggedNote, newCats as NoteCategory[]);
                      setDraggedNote(null);
                      setDragSourceCat(null);
                    }}
                  >
                    <button
                      onClick={() => toggleCategoryExpand(cat.id)}
                      className="flex-1 text-left px-2 py-1.5 flex items-center gap-2"
                    >
                      <span className={`material-symbols-outlined text-[14px] text-[#e4e2e4]/30 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}>
                        chevron_right
                      </span>
                      <span className="material-symbols-outlined text-[16px]" style={{ color }}>
                        {isExpanded ? 'folder_open' : 'folder'}
                      </span>
                      <span className={`text-sm truncate transition-colors duration-100 ${isExpanded ? 'text-[#e4e2e4] font-medium' : 'text-[#e4e2e4]/60'}`}>
                        {cat.label}
                      </span>
                    </button>
                    <span className="text-[10px] text-[#555] pr-2 group-hover:hidden font-mono tabular-nums">{categoryNotes.length}</span>
                    <div className="hidden group-hover:flex items-center gap-1 pr-1.5">
                      <button
                        onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.label); }}
                        className="text-[#e4e2e4]/30 hover:text-[#e4e2e4] w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#353437] transition-colors"
                        title="Renommer"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                      </button>
                      <button
                        onClick={handleDelete}
                        className="text-[#e4e2e4]/30 hover:text-red-400 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Supprimer"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    </div>
                  </div>
                )}

                {isExpanded && !isEditing && (
                  <div className="pl-8 ml-1 border-l border-[#534344]/20 space-y-0.5 mt-0.5 max-h-48 overflow-y-auto">
                    {categoryNotes.length === 0 ? (
                      <p className="text-[11px] text-[#e4e2e4]/30 py-1.5 px-2">Aucune note</p>
                    ) : (
                      categoryNotes.map(note => (
                        <button
                          key={note.id}
                          draggable
                          onDragStart={() => { setDraggedNote(note); setDragSourceCat(cat.id); }}
                          onDragEnd={() => { setDraggedNote(null); setDragSourceCat(null); setDragOverCat(null); }}
                          onClick={() => { setSection(cat.id as Section); openNote(note); }}
                          className={`w-full text-left px-2 py-1 rounded text-xs transition-colors duration-100 truncate cursor-grab active:cursor-grabbing
                            ${draggedNote?.id === note.id ? 'opacity-30' :
                              selected?.id === note.id ? 'text-[#ffcbd0] font-medium' :
                              'text-[#e4e2e4]/50 hover:text-[#e4e2e4]'
                            }`}
                        >
                          {noteTitle(note)}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Formulaire nouvelle catégorie */}
          {showNewCatForm && (
            <div className="mt-2 space-y-2 px-2">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newCatLabel}
                  onChange={e => setNewCatLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createCategory()}
                  placeholder="Nom de la catégorie…"
                  className="flex-1 bg-[#0e0e10] border-none rounded-lg px-3 py-1.5 text-sm text-[#e4e2e4] placeholder-[#e4e2e4]/30 focus:outline-none focus:ring-1 focus:ring-[#ffcbd0]/40"
                  autoFocus
                />
              </div>
              <div className="flex gap-1.5 flex-wrap px-0.5">
                {['#3B82F6','#22C55E','#EF4444','#F59E0B','#A855F7','#EC4899','#06B6D4','#F97316','#8B5CF6','#10B981','#6B7280','#1D9BF0'].map(hex => (
                  <button
                    key={hex}
                    onClick={() => setNewCatColor(hex)}
                    className={`w-5 h-5 rounded-full transition-all ${newCatColor === hex ? 'ring-2 ring-offset-1 ring-offset-[#1b1b1d] ring-white scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={createCategory}
                  disabled={!newCatLabel.trim()}
                  className="flex-1 bg-gradient-to-br from-[#ffcbd0] to-[#fda4af] text-[#571c27] text-xs py-1.5 rounded-lg font-semibold disabled:opacity-40"
                >
                  Créer
                </button>
                <button
                  onClick={() => { setShowNewCatForm(false); setNewCatLabel(''); setNewCatColor('#6B7280'); }}
                  className="flex-1 bg-[#353437]/50 text-[#e4e2e4]/60 text-xs py-1.5 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer sidebar */}
        <div className="mt-auto px-2 py-3 flex items-center gap-1">
          <button
            onClick={() => { setSection('settings'); setSelected(null); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors duration-150
              ${section === 'settings'
                ? 'text-[#ffcbd0] bg-[#ffcbd0]/10'
                : 'text-[#e4e2e4]/40 hover:text-[#e4e2e4] hover:bg-[#353437]/50'
              }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Catégories
          </button>
          <a
            href="/settings"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[#e4e2e4]/40 hover:text-[#e4e2e4] hover:bg-[#353437]/50 transition-colors duration-150"
          >
            <span className="material-symbols-outlined text-[16px]">person</span>
            Compte
          </a>
          <button
            onClick={handleLogout}
            className="ml-auto flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-[#e4e2e4]/40 hover:text-[#e4e2e4] hover:bg-[#353437]/50 transition-colors duration-150"
            title="Déconnexion"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
          </button>
        </div>
      </aside>
```

- [ ] **Step 3 : Vérifier le build**

```bash
cd /Users/gabrielemeksiz/brayn-main && npm run build
```

Résultat attendu : `✓ Compiled successfully`

- [ ] **Step 4 : Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: redesign sidebar — explorateur Obsidian avec Material Symbols"
```

---

## Task 3 : Zone principale — Barre de recherche + chips + layout (page.tsx)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1 : Remplacer le bloc `<main>` et la barre de recherche**

Localiser `{/* Zone principale */}` (ligne ~587) et remplacer jusqu'à la fermeture de la div des chips (ligne ~633) :

**Ancienne ouverture main + search :**
```tsx
      {/* Zone principale */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#191919]">
        {/* Barre de recherche */}
        <div className="px-6 pt-4 pb-3 border-b border-[#2A2A2A] space-y-2.5 shrink-0">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060] pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher dans mon cerveau…"
                className="w-full bg-[#252525] border border-[#2A2A2A] rounded-[4px] pl-8 pr-4 py-[7px] text-[14px] placeholder-[#606060] text-[#D4D4D4] focus:outline-none focus:border-[#2E7CD1] transition-colors duration-100"
              />
            </div>
            <select
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value as 'today' | '7d' | '30d' | 'all')}
              className="bg-[#252525] border border-[#2A2A2A] rounded-[4px] px-3 py-[7px] text-[13px] text-[#9B9B9B] focus:outline-none focus:border-[#2E7CD1] transition-colors duration-100 hover:border-[#333] cursor-pointer"
            >
              <option value="all">Tout</option>
              <option value="today">Aujourd&apos;hui</option>
              <option value="7d">7 jours</option>
              <option value="30d">30 jours</option>
            </select>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {categories.map(cat => {
              const color = getCatColor(cat.id);
              const isActive = filterCat === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setFilterCat(filterCat === cat.id ? null : cat.id)}
                  className="px-2.5 py-[3px] rounded-[4px] text-[12px] border whitespace-nowrap transition-all duration-100"
                  style={isActive
                    ? { backgroundColor: `${color}33`, color, borderColor: `${color}80` }
                    : { backgroundColor: 'transparent', color: `${color}99`, borderColor: `${color}50`, opacity: 0.7 }
                  }
                >
                  {getCatLabel(cat.id)}
                </button>
              );
            })}
          </div>
        </div>
```

**Remplacer par :**
```tsx
      {/* Zone principale */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#131315]">
        {/* Barre de recherche */}
        <div className="px-6 pt-4 pb-3 space-y-2.5 shrink-0">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#e4e2e4]/30 pointer-events-none text-[18px]">search</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher dans mon cerveau…"
                className="w-full bg-[#0e0e10] border-none rounded-lg pl-10 pr-4 py-2 text-sm placeholder-[#e4e2e4]/30 text-[#e4e2e4] focus:outline-none focus:ring-1 focus:ring-[#ffcbd0]/40 transition-all"
              />
            </div>
            <select
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value as 'today' | '7d' | '30d' | 'all')}
              className="bg-[#0e0e10] border-none rounded-lg px-3 py-2 text-xs text-[#e4e2e4]/60 focus:outline-none focus:ring-1 focus:ring-[#ffcbd0]/40 cursor-pointer"
            >
              <option value="all">Tout</option>
              <option value="today">Aujourd&apos;hui</option>
              <option value="7d">7 jours</option>
              <option value="30d">30 jours</option>
            </select>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {categories.map(cat => {
              const isActive = filterCat === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setFilterCat(filterCat === cat.id ? null : cat.id)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-150
                    ${isActive
                      ? 'bg-[#ffcbd0]/15 text-[#ffcbd0] border border-[#ffcbd0]/30'
                      : 'bg-[#353437] text-[#e4e2e4]/50 hover:text-[#e4e2e4] hover:bg-[#353437]/80'
                    }`}
                >
                  {getCatLabel(cat.id)}
                </button>
              );
            })}
          </div>
        </div>
```

- [ ] **Step 2 : Restyler la modale de confirmation de suppression**

Localiser `{confirmDelete && (` et remplacer la div `bg-[#252525] border border-[#2A2A2A]` :

```tsx
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1f1f21] rounded-2xl p-6 w-[340px] shadow-[0px_20px_40px_rgba(0,0,0,0.4)] border border-[#534344]/15">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-400 text-[18px]">delete</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#e4e2e4]">Supprimer cette note ?</p>
                <p className="text-xs text-[#e4e2e4]/40 mt-0.5">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-[#353437]/50 text-[#e4e2e4]/70 hover:text-[#e4e2e4] text-sm py-2 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => deleteNotes([confirmDelete])}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm py-2 rounded-xl transition-colors font-semibold"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 3 : Vérifier le build**

```bash
cd /Users/gabrielemeksiz/brayn-main && npm run build
```

- [ ] **Step 4 : Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: redesign search bar, category chips, delete modal"
```

---

## Task 4 : Composant NoteList

**Files:**
- Modify: `src/components/NoteList.tsx`

- [ ] **Step 1 : Remplacer le contenu complet de NoteList.tsx**

```tsx
'use client';

import { useState } from 'react';
import type { Note } from '@/lib/types';
import { formatDate } from '@/lib/utils';

function noteTitle(note: Note): string {
  const tweetRegex = /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
  const isTweet =
    note.links?.some(l => tweetRegex.test(l)) ||
    tweetRegex.test(note.original_text ?? '');
  if (isTweet) return note.clean_original_language ?? note.original_text ?? '';
  return note.original_text ?? '';
}

function noteSnippet(note: Note): string {
  const tweetRegex = /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
  const isTweet =
    note.links?.some(l => tweetRegex.test(l)) ||
    tweetRegex.test(note.original_text ?? '');
  if (isTweet) return '';
  return note.clean_original_language ?? '';
}

interface NoteListProps {
  notes: Note[];
  loading: boolean;
  onSelect: (note: Note) => void;
  onDeleteMulti: (ids: string[]) => void;
  getCatColor: (cat: string) => string;
  getCatLabel: (cat: string) => string;
}

export function NoteList({
  notes,
  loading,
  onSelect,
  onDeleteMulti,
  getCatColor,
  getCatLabel,
}: NoteListProps) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    onDeleteMulti(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <p className="text-sm text-[#e4e2e4]/30">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-widest text-[#e4e2e4]/30 font-bold">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            {selectMode && selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
                Supprimer ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors
                ${selectMode
                  ? 'bg-[#ffcbd0]/15 text-[#ffcbd0]'
                  : 'text-[#e4e2e4]/40 hover:text-[#e4e2e4] hover:bg-[#353437]/50'
                }`}
            >
              {selectMode ? 'Annuler' : 'Sélectionner'}
            </button>
          </div>
        </div>

        {/* Liste */}
        {notes.length === 0 ? (
          <p className="text-sm text-[#e4e2e4]/30 pt-12 text-center">Aucune note</p>
        ) : (
          <div className="space-y-1">
            {notes.map(note => {
              const isChecked = selectedIds.has(note.id);
              const snippet = noteSnippet(note);
              return (
                <div
                  key={note.id}
                  onClick={() => selectMode ? toggleId(note.id) : onSelect(note)}
                  className={`group flex items-start gap-3 w-full text-left p-5 rounded-xl transition-all duration-150 cursor-pointer
                    ${isChecked
                      ? 'bg-red-500/10'
                      : 'hover:bg-[#1b1b1d]'
                    }`}
                >
                  {selectMode && (
                    <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors
                      ${isChecked ? 'bg-red-500 border-red-500' : 'border-[#534344]'}`}
                    >
                      {isChecked && (
                        <span className="material-symbols-outlined text-white text-[12px]" style={{fontVariationSettings:"'FILL' 1"}}>check</span>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-[15px] font-semibold text-[#e4e2e4] truncate group-hover:text-[#ffcbd0] transition-colors duration-150">
                        {noteTitle(note)}
                      </p>
                    </div>
                    {snippet && (
                      <p className="text-sm text-[#e4e2e4]/50 line-clamp-1 mb-3">{snippet}</p>
                    )}
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-[11px] font-medium text-[#e4e2e4]/30 uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                        {formatDate(note.created_at)}
                      </span>
                      {note.categories.slice(0, 2).map(cat => (
                        <span
                          key={cat}
                          className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#353437] text-[#d8c1c3]"
                        >
                          {getCatLabel(cat)}
                        </span>
                      ))}
                      {!note.seen && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffcbd0] ml-auto">Nouveau</span>
                      )}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#e4e2e4]/10 group-hover:text-[#ffcbd0]/30 transition-colors shrink-0 mt-0.5">more_vert</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier le build**

```bash
cd /Users/gabrielemeksiz/brayn-main && npm run build
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/NoteList.tsx
git commit -m "feat: redesign NoteList — tonal hover, snippets, Material Symbols"
```

---

## Task 5 : Composant NoteDetail — Header + actions

**Files:**
- Modify: `src/components/NoteDetail.tsx`

- [ ] **Step 1 : Remplacer la div racine, les banners IA, les boutons d'action et le header titre**

Localiser le `return (` de NoteDetail (ligne ~137) et remplacer jusqu'à la balise `<div className="border-b border-[#2A2A2A] mb-4" />` (ligne ~290) incluse :

```tsx
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-3xl mx-auto px-8 pt-6 pb-16">

          {/* AI Status Banner */}
          {note.ai_status === 'processing' && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 text-amber-400 text-sm">
              <span className="material-symbols-outlined text-[18px] animate-spin">autorenew</span>
              Classification IA en cours…
            </div>
          )}
          {note.ai_status === 'failed' && (
            <div className="mb-4 flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 text-sm">
              <span>Erreur lors de la classification IA.</span>
              <button
                onClick={handleClassifyWithAI}
                disabled={classifying}
                className="text-xs underline hover:no-underline disabled:opacity-50"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* Métadonnées source */}
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-[#2a2a2c] text-[#e4e2e4]/50 text-[10px] tracking-widest uppercase px-2 py-1 rounded">
              {note.source}
            </span>
            <span className="text-[#e4e2e4]/30 text-[11px]">{formatDate(note.created_at)}</span>
          </div>

          {/* Titre */}
          <div className="mb-6">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); saveTitle(); }
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                className="w-full bg-transparent text-4xl font-extrabold tracking-tighter text-[#e4e2e4] leading-tight focus:outline-none border-b border-[#ffcbd0]/40 pb-1 mb-4"
                autoFocus
              />
            ) : (
              <h1
                className="text-4xl font-extrabold tracking-tighter text-[#e4e2e4] leading-tight mb-4 cursor-text hover:text-[#ffcbd0] transition-colors duration-150"
                onClick={() => {
                  setEditingTitle(true);
                  setTitleValue(note.original_text ?? '');
                  setTimeout(() => titleInputRef.current?.select(), 30);
                }}
                title="Cliquer pour modifier le titre"
              >
                {noteTitle(note)}
              </h1>
            )}

            {/* Catégories inline */}
            <div className="flex items-center gap-2 flex-wrap">
              {note.categories.map(cat => (
                <span
                  key={cat}
                  className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-[#353437] text-[#d8c1c3]"
                >
                  {getCatLabel(cat)}
                  <button
                    onClick={() => updateNoteCategories(note.categories.filter(c => c !== cat) as NoteCategory[])}
                    className="opacity-40 hover:opacity-100 leading-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
              <select
                value=""
                onChange={e => {
                  const cat = e.target.value as NoteCategory;
                  if (cat && !note.categories.includes(cat)) {
                    updateNoteCategories([...note.categories, cat] as NoteCategory[]);
                  }
                }}
                className="text-[10px] bg-[#0e0e10] border-none rounded-lg px-2 py-1 text-[#e4e2e4]/40 focus:outline-none focus:ring-1 focus:ring-[#ffcbd0]/40 cursor-pointer"
              >
                <option value="">+ Catégorie</option>
                {getAllCategories()
                  .filter(c => !note.categories.includes(c as NoteCategory))
                  .map(cat => (
                    <option key={cat} value={cat}>{getCatLabel(cat)}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center gap-2 mb-8">
            {note.source === 'desktop' && note.ai_status === 'pending' && (
              <button
                onClick={handleClassifyWithAI}
                disabled={classifying}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#e4e2e4]/50 hover:text-[#e4e2e4] hover:bg-[#353437]/50 transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                Classer avec l&apos;IA
              </button>
            )}
            <button
              onClick={() => setShowChat(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors
                ${showChat
                  ? 'bg-[#ffcbd0]/15 text-[#ffcbd0] border border-[#ffcbd0]/20'
                  : 'text-[#e4e2e4]/50 hover:text-[#e4e2e4] hover:bg-[#353437]/50'
                }`}
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              Chat IA
              {chatMessages.length > 0 && (
                <span className="text-[9px] bg-[#ffcbd0] text-[#571c27] rounded-full px-1.5 py-0.5 font-bold tabular-nums">
                  {chatMessages.length}
                </span>
              )}
            </button>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => onDeleteRequest(note.id)}
                className="text-[#e4e2e4]/30 hover:text-red-400 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors"
                title="Supprimer cette note"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
              <button
                onClick={onBack}
                className="text-[#e4e2e4]/30 hover:text-[#e4e2e4] w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#353437]/50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
```

- [ ] **Step 2 : Vérifier le build**

```bash
cd /Users/gabrielemeksiz/brayn-main && npm run build
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/NoteDetail.tsx
git commit -m "feat: redesign NoteDetail header — titre large, actions Material Symbols"
```

---

## Task 6 : Composant NoteDetail — Chat IA panel

**Files:**
- Modify: `src/components/NoteDetail.tsx`

- [ ] **Step 1 : Remplacer le bloc `{showChat && (`**

Localiser `{/* Chat IA panel */}` jusqu'à la fin du composant et remplacer le bloc `showChat` :

```tsx
      {/* Chat IA panel */}
      {showChat && (
        <div className="h-80 shrink-0 border-t border-[#534344]/15 flex flex-col bg-[#131315]/80 backdrop-blur-xl shadow-[0px_-10px_40px_rgba(0,0,0,0.3)]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-[#353437]/20 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#ffcbd0] shadow-[0_0_10px_rgba(255,203,208,0.5)]" />
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#ffcbd0]">
                Assistant IA Brayn
              </span>
            </div>
            <button
              onClick={() => setShowChat(false)}
              className="text-[#e4e2e4]/30 hover:text-[#ffcbd0] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {chatMessages.length === 0 && (
              <p className="text-xs text-[#e4e2e4]/30 text-center pt-6 uppercase tracking-widest">
                Pose une question sur cette note…
              </p>
            )}
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0
                  ${msg.role === 'assistant'
                    ? 'bg-gradient-to-br from-[#ffcbd0] to-[#fda4af]'
                    : 'bg-[#353437]'
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[14px]"
                    style={{ fontVariationSettings: msg.role === 'assistant' ? "'FILL' 1" : "'FILL' 0", color: msg.role === 'assistant' ? '#571c27' : '#e4e2e4' }}
                  >
                    {msg.role === 'assistant' ? 'auto_awesome' : 'person'}
                  </span>
                </div>
                <div className={`flex flex-col gap-1 max-w-[80%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                  <span className="text-[9px] text-[#e4e2e4]/30 uppercase tracking-widest">
                    {msg.role === 'assistant' ? 'Assistant' : 'Vous'}
                  </span>
                  <div className={`px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
                    ${msg.role === 'user'
                      ? 'bg-[#ffcbd0]/10 rounded-2xl rounded-tr-none border border-[#ffcbd0]/10 text-[#e4e2e4]/90'
                      : 'bg-[#2a2a2c]/50 rounded-2xl rounded-tl-none text-[#e4e2e4]/90'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ffcbd0] to-[#fda4af] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[14px] text-[#571c27]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                </div>
                <div className="bg-[#2a2a2c]/50 rounded-2xl rounded-tl-none px-4 py-3">
                  <span className="flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 bg-[#ffcbd0]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#ffcbd0]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#ffcbd0]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <div className="px-5 py-3 shrink-0">
            <form
              onSubmit={async e => {
                e.preventDefault();
                const msg = chatInput.trim();
                if (!msg || chatLoading) return;
                const optimistic: ChatMessage = {
                  id: Date.now().toString(),
                  role: 'user',
                  content: msg,
                  created_at: new Date().toISOString(),
                };
                setChatMessages(prev => [...prev, optimistic]);
                setChatInput('');
                setChatLoading(true);
                setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                try {
                  const res = await fetch(`/api/notes/${note.id}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg }),
                  });
                  const data = await res.json();
                  const reply: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: data.reply ?? 'Erreur',
                    created_at: new Date().toISOString(),
                  };
                  setChatMessages(prev => [...prev, reply]);
                } catch {
                  setChatMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: 'Erreur de connexion.',
                    created_at: new Date().toISOString(),
                  }]);
                } finally {
                  setChatLoading(false);
                  setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                }
              }}
              className="flex gap-2"
            >
              <div className="flex-1 bg-[#1f1f21]/60 backdrop-blur-xl border border-[#534344]/10 rounded-2xl px-4 py-2 shadow-[0px_20px_40px_rgba(0,0,0,0.4)] flex items-center">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Posez une question sur cette note…"
                  disabled={chatLoading}
                  className="flex-1 bg-transparent border-none text-sm text-[#e4e2e4] placeholder-[#e4e2e4]/30 focus:outline-none disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="bg-[#ffcbd0] hover:opacity-90 text-[#571c27] px-4 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#ffcbd0]/20 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier le build final**

```bash
cd /Users/gabrielemeksiz/brayn-main && npm run build
```

Résultat attendu : `✓ Compiled successfully` zéro erreur.

- [ ] **Step 3 : Commit final**

```bash
git add src/components/NoteDetail.tsx
git commit -m "feat: redesign NoteDetail chat panel — glassmorphism rose Stitch"
```

---

## Tests manuels post-implémentation

Lancer le serveur dev :
```bash
npm run dev
```

Vérifier dans le navigateur sur `http://localhost:3000` :

- [ ] Sidebar : fond `#1b1b1d`, pas de bordure droite visible
- [ ] Logo "Brayn" avec icône terminal visible
- [ ] Bouton "Nouvelle Note" avec dégradé rose
- [ ] Items "Nouveaux" et "Tous" avec indicateur `border-l-2` rose quand actifs
- [ ] Catégories affichées avec icône `folder` / `folder_open` + `chevron_right` / `expand_more`
- [ ] Cliquer une catégorie → elle s'ouvre, les notes s'affichent en arbre indenté avec `border-l`
- [ ] Drag & drop d'une note vers une autre catégorie fonctionne (highlight rose)
- [ ] Badge "Nouveaux" s'affiche en rose si des notes non lues
- [ ] Search bar sans bordure, fond `#0e0e10`, icône search Material Symbols
- [ ] Chips catégories restyilés (uppercase, gris neutre, rose quand actif)
- [ ] NoteList : cartes sans bordures, hover `#1b1b1d`, snippet visible, date uppercase
- [ ] Note detail : titre en `text-4xl font-extrabold tracking-tighter`
- [ ] Bouton "Chat IA" actif → fond rose translucide
- [ ] Chat panel : glassmorphism, header avec point lumineux rose, bulles redessinées
- [ ] Envoi message chat fonctionne, loading dots roses
- [ ] Modale suppression : style dark rounded-2xl
- [ ] Scrollbar fine (4px) visible sur les listes longues
- [ ] Icônes Material Symbols chargées correctement (pas de fallback texte)
