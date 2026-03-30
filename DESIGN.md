# Design System Strategy: The Nocturnal Minimalist

### 1. Overview & Creative North Star
**Creative North Star: "The Silent Architect"**
This design system rejects the "loud" patterns of standard SaaS interfaces in favor of a quiet, high-end editorial experience. It draws inspiration from the precision of *Linear* and the spatial flexibility of *Notion*, but elevates them through a "No-Line" philosophy.

We move beyond the template look by utilizing **intentional asymmetry** and **tonal depth**. Rather than boxing content in with strokes, we allow the UI to breathe through expansive white space (or "dark space") and sophisticated layering. The goal is a digital environment that feels like a premium workspace: calm, focused, and impeccably organized.

---

### 2. Colors: Tonal Atmosphere
The palette is rooted in a "Deep Obsidian" spectrum, punctuated by a "Dusty Rose" accent. We do not use pure black; we use depth.

* **Primary Accent (`#ffcbd0`):** Use for high-intent actions. This soft pastel pink provides a human touch against the cold grey, but it must be used sparingly to maintain its premium "rare" feel.
* **Neutral Foundation:**
* `background`: `#131315` (The base canvas)
* `surface-container-low`: `#1b1b1d` (Sectioning)
* `surface-container-highest`: `#353437` (Active states/Floating elements)

**The "No-Line" Rule**
Traditional 1px borders are strictly prohibited for sectioning. We define boundaries through **background shifts**. A sidebar is not "separated" by a line; it is simply a `surface-container-low` block sitting against a `surface` background. This creates a seamless, "molded" look rather than a "constructed" one.

**The Glass & Gradient Rule**
For primary CTAs and header highlights, utilize subtle linear gradients:
* *Direction:* 135deg
* *From:* `primary` (`#ffcbd0`) to `primary-container` (`#fda4af`)
This adds a "visual soul" and three-dimensional softness that flat hex codes lack.

---

### 3. Typography: Editorial Precision
We utilize **Inter** exclusively. The hierarchy is designed to feel like a high-end technical manual—clear, functional, and authoritative.

* **Display (Large Scale):** Use `display-md` (2.75rem) with `-0.02em` letter spacing for hero headers. This creates a tight, "printed" feel.
* **Headlines & Titles:** Always use `title-lg` or `headline-sm` for section headers in French (e.g., *Tableau de bord*, *Projets récents*).
* **The Label Strategy:** Use `label-md` (0.75rem) in uppercase with `0.05em` tracking for metadata. This distinguishes functional labels from narrative body text.
* **Tone:** All French labels must be formal and concise. Avoid "tu," use "vous." Never use emojis.

---

### 4. Elevation & Depth: Tonal Layering
In this system, depth is not "shadow"; depth is "material."

* **The Layering Principle:**
* **Level 0:** `surface` (Main background)
* **Level 1:** `surface-container-low` (Secondary navigation/Side panels)
* **Level 2:** `surface-container-high` (Cards, Modals)
* **Ambient Shadows:** For floating elements (like dropdowns), use an extra-diffused shadow: `0px 20px 40px rgba(0, 0, 0, 0.4)`. The shadow must feel like a soft blur, not a dark smudge.
* **The "Ghost Border" Fallback:** If accessibility requires a stroke (e.g., in a high-density data table), use `outline-variant` (`#534344`) at **15% opacity**. It should be felt, not seen.
* **Glassmorphism:** Use `backdrop-filter: blur(12px)` with a semi-transparent `surface-container-lowest` for floating navigation bars. This allows content to bleed through, maintaining a sense of place.

---

### 5. Components: Functional Primitives

* **Buttons:**
* *Primary:* Gradient (`primary` to `primary-container`), `on-primary` text, `md` (0.375rem) roundedness.
* *Secondary:* `surface-container-highest` background. No border.
* *Tertiary:* Transparent background, `primary` text. Use for "Annuler" or low-priority actions.
* **Input Fields:**
* Use `surface-container-lowest` for the field background.
* Focus state: A subtle `1px` ghost border using the `primary` color at 40% opacity.
* Label: `Nom d'utilisateur` (Always above the field in `label-md`).
* **Cards & Lists:**
* **Forbid dividers.** To separate list items, use a `12px` (3) vertical gap or a hover state that changes the background to `surface-container-low`.
* Padding: Always use a minimum of `24px` (6) for card internal spacing to maintain the "premium breathing room."
* **Chips (Badges):**
* Minimalist styling: `surface-container-high` background with `on-surface-variant` text.
* Status indicators (e.g., *En cours*, *Terminé*) use a small 6px circle of the status color next to the text instead of a full colored background.

---

### 6. Do's and Don'ts

#### **Do:**
* **Use Asymmetry:** Place important text (like a `display-sm` header) slightly off-center or with significant top-padding to create an editorial feel.
* **Focus on Micro-copy:** Use precise French (e.g., *Rechercher* instead of *Chercher*, *Soumettre* instead of *Envoyer*).
* **Respect the "No-Emoji" Rule:** Maintain a high-end professional atmosphere. Use SVG icons (20px, light weight) if visual cues are needed.

#### **Don't:**
* **Don't use 100% white:** Never use `#FFFFFF`. Use `on-surface` (`#e4e2e4`) to prevent eye strain and maintain the dark-mode harmony.
* **Don't use standard shadows:** Avoid the default CSS `box-shadow: 0 2px 4px`. It looks cheap. Use our Tonal Layering or the Ambient Shadow spec.
* **Don't crowd the UI:** If you feel the need to add a divider line, try adding `16px` of extra space instead. Space is your primary separator.