# brayn

Brayn – Product Requirements Document (PRD v1)
1. Résumé produit
Brayn est un second cerveau personnel : une app qui permet de capturer toutes tes pensées, idées, liens et inspirations au quotidien, principalement depuis ton téléphone, puis de les relire et organiser depuis ton ordinateur.

Le produit est strictement non commercial, conçu pour un usage individuel (toi seul), avec une ambition d’usage quotidien.

Brayn vise d’abord à offrir un endroit unique, fiable et simple pour écrire “n’importe quoi, n’importe comment”, sans se soucier du cloud ou de la dispersion entre outils, et à terme à approfondir ces idées avec l’IA et une visualisation type mindmap.

2. Contexte et problème
Tu as tendance à penser à beaucoup de choses en même temps et à t’éparpiller, ce qui fait que certaines idées ou pensées importantes se perdent.

Les outils existants (Notion, Obsidian, Figma, etc.) sont puissants mais lourds à utiliser pour de la capture ultra rapide et spontanée, ou bien ne correspondent pas exactement à ton flux mental du moment.

Problèmes principaux :

Tu oublies des idées/pensées que tu aurais voulu garder.

Tu n’as pas un endroit unique, simple et instantané pour tout noter.

Tu voudrais pouvoir rechercher plus tard dans ces pensées, et les approfondir avec l’IA.

Importance subjective du projet : 7/10, avec l’envie de l’utiliser tous les jours.

3. Vision produit
Créer un environnement numérique unique où :

Tu peux saisir rapidement n’importe quelle pensée, idée, lien ou référence, depuis ton téléphone ou ton ordinateur.

Toutes ces informations sont centralisées, consultables et recherchables.

Progressivement, tu peux organiser, relier et approfondir ces idées avec de l’IA et des visualisations (mindmap, graph de connaissances).

Brayn doit devenir ton “hub mental” minimaliste : la première chose que tu ouvres pour capturer ton flux de pensée brut.

4. Utilisateur cible
Utilisateur unique : toi.

Profil :

Pense beaucoup, génère beaucoup d’idées.

A tendance à s’éparpiller mentalement.

À l’aise techniquement, mais souhaite un outil simple côté UX.

Contexte d’usage :

Mobile : dans la vie de tous les jours, sur iPhone/Android via le navigateur (ou PWA plus tard).

Desktop : sur ton Mac, connecté en wifi, pour relire, organiser, faire de la réflexion plus profonde.

5. Objectifs et non-objectifs
5.1 Objectifs (V1)
Permettre la capture ultra simple de pensées/notes depuis le téléphone.

Centraliser toutes les notes dans un même système, avec synchro fiable entre mobile et desktop.

Permettre la consultation et la recherche de ces notes depuis le desktop.

Offrir une interface minimaliste en mode sombre, qui ne gêne pas le flux de pensée.

5.2 Non-objectifs (V1)
Les éléments suivants ne doivent pas bloquer la sortie de la V1 :

IA avancée (résumé automatique, approfondissement, suggestions, graph sémantique).

Mindmap interactive et visualisations avancées du “graph de connaissances”.

Intégrations complètes avec Notion, Obsidian, Figma, etc. (sync bidirectionnelle).

Partage avec d’autres utilisateurs, multi-compte, permissions.

Optimisation offline poussée.

Ces points sont explicitement pour les versions ultérieures (V1.1 / V2+).

6. Cas d’usage clés
Cas d’usage 1 – Capture rapide sur mobile
Situation : tu es dehors / dans les transports / chez toi, une idée te vient.

Workflow :

Tu ouvres Brayn sur ton téléphone.

L’écran “Nouvelle note” s’affiche directement avec un champ texte.

Tu écris ce qui te vient, éventuellement tu colles un lien (tweet, article, vidéo).

Tu appuies sur “Enregistrer”.

Résultat attendu : la note est sauvegardée, accessible immédiatement sur desktop.

Cas d’usage 2 – Session d’organisation sur desktop
Situation : tu es sur ton Mac, connecté en wifi, tu veux relire et faire le tri.

Workflow :

Tu ouvres Brayn sur desktop.

Tu vois la liste de toutes tes notes, les plus récentes en haut.

Tu sélectionnes une note, la lis en détail.

Tu peux corriger, compléter, ajouter des tags simples, ou supprimer.

Résultat attendu : meilleure clarté mentale, notes plus propres et plus utiles.

Cas d’usage 3 – Recherche d’une idée
Situation : tu te souviens avoir pensé à un concept ou projet, mais tu ne sais plus quand.

Workflow :

Tu ouvres Brayn sur desktop.

Tu tapes un mot-clé dans le champ de recherche.

La liste de notes se filtre pour afficher celles qui contiennent ce mot.

Résultat attendu : retrouver rapidement une idée précise parmi tout ton flux mental.

7. Fonctionnalités du MVP
7.1 Capture de notes
Page “Nouvelle note” :

Un champ texte multi-ligne (body).

Placeholder du style “Écris ce qui te passe par la tête…”.

Bouton “Enregistrer”.

Métadonnées ajoutées automatiquement :

Date/heure de création.

Source / device (“mobile” ou “desktop”).

7.2 Liste et affichage des notes
Vue “Liste de notes” sur desktop :

Affichage des notes par ordre antichronologique (plus récentes en haut).

Chaque entrée affiche : début de la note (ex : 80–120 premiers caractères) + date.

Vue “Détail de note” :

Affichage complet du texte.

Affichage éventuel des liens (URL cliquables).

7.3 Édition et suppression
Depuis la vue détail :

Bouton “Modifier” pour éditer le texte de la note.

Bouton “Supprimer” pour enlever la note (suppression définitive OK, pas besoin de corbeille pour la V1).

7.4 Organisation légère
Champs “tags” (optionnels) sous forme de liste de mots-clés libres (ex : “business”, “idée”, “perso”).

Interface minimale pour ajouter/retirer des tags dans la vue détail.

7.5 Recherche
Champ de recherche texte sur la vue liste desktop.

Recherche plein texte sur le contenu de la note (body), et éventuellement sur les tags.

8. Roadmap fonctionnelle (post-V1)
8.1 IA et approfondissement
Bouton “Demander à l’IA” sur une note pour :

Résumer la note.

Développer l’idée (brainstorming, exemples, plans d’action).

Proposer des questions pour aller plus loin.

8.2 Mindmap / graph de connaissances
Visualisation des notes comme un graphe : nœuds = notes, arêtes = liens conceptuels.

Possibilité de créer des relations explicites entre notes (ex : “cette note est liée à celle-ci”).

Navigation visuelle pour explorer ton second cerveau.

8.3 Intégrations externes
Export de notes vers Notion / Obsidian.

Import ou liens profonds depuis ces outils.
​

9. Données et modèle conceptuel
9.1 Entité Note
Champs envisagés pour V1 :

id : identifiant unique.

body : contenu texte libre.

createdAt : date de création.

updatedAt : date de dernière modification.

source : “mobile” | “desktop” (optionnel).

tags : liste de strings (optionnelle).

links : liste d’URL (stockées dans le texte ou en champ séparé).

9.2 Relations futures
NoteRelation (post-V1) : type A lié à B, pour la mindmap.

Éventuellement une entité User même si tu es seul, pour assurer une structure extensible.

10. Exigences non fonctionnelles
Fiabilité : aucune perte de données dans les scénarios normaux.

Performance :

Temps de création de note quasiment instantané.

Temps de chargement de la liste acceptable même avec un volume important de notes.

Simplicité :

UX minimaliste, dark mode dès la V1.

Peu d’options visibles, focus sur la saisie et la lecture.

Sécurité / confidentialité :

Authentification simple (un compte, login).

Pas de partage public par défaut.

11. Contraintes techniques (haut niveau)
Application web (responsive) accessible :

sur mobile (capture),

sur desktop (gestion).

Authentification minimale :

Un seul utilisateur, mais système d’auth pour éviter un accès non désiré.

Base de données unique (notes) avec persistance.

Pas de besoin offline strict pour la V1 (wifi/5G OK).

La stack concrète (ex : Next.js + Prisma + SQLite/Postgres) sera détaillée dans un document technique séparé, mais ce PRD reste agnostique.

12. Organisation, scope et risques
Horizon souhaité pour une V1 utilisable : le plus vite possible (typiquement quelques semaines max avec 1h/jour).

Disponibilité : minimum 1h par jour.

Style de travail : par “moments”, pas forcément en sprints rigides.

Risques principaux :

Complexité technique (implémentation stack, auth, déploiement).

Stratégie de mitigation :

Limiter le scope V1 au strict nécessaire :

Écriture, liste, lecture, édition, suppression, recherche.

Reporter IA, mindmap, intégrations à des versions ultérieures.

S’appuyer fortement sur l’IA (Claude, etc.) pour générer le code de chaque brique.

13. Critères de succès V1
La V1 est considérée comme réussie si :

Tu peux ouvrir Brayn sur ton téléphone, taper une note et l’enregistrer sans bug.

Tu peux ouvrir Brayn sur ton Mac, voir la liste des notes, en lire une, la modifier et la supprimer.

Tu peux chercher un mot-clé et retrouver une note spécifique.

Tu te surprends à l’utiliser au moins quelques fois par semaine sans te forcer.

