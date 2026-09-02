# Guide — bibliothèque d'onboarding React

Date : 2026-09-02
Statut : design validé, en attente de relecture avant plan d'implémentation

## 1. Objectif

Fournir une bibliothèque React open source pour l'onboarding produit : tours
guidés avec spotlight, puis checklist de premiers pas. Elle sert d'abord
Qualiresolve, mais elle est conçue pour être utilisable par n'importe quelle
application React, et publiée sous licence MIT.

Le besoin immédiat côté Qualiresolve est d'accompagner un nouvel utilisateur
hospitalier sur ses premiers écrans, sans embarquer de script tiers qui verrait
des données de santé.

## 2. Pourquoi une nouvelle bibliothèque

L'état de l'art a été évalué avant de décider.

| Solution | Licence | Verdict |
|---|---|---|
| Intro.js | AGPL ou commerciale | Exclue. Incompatible avec un SaaS fermé. |
| Shepherd.js | AGPL ou commerciale | Exclue pour la même raison. |
| react-joyride | MIT | Lourde, suivi lent de React 19, rendu difficile à aligner sur un thème MUI. |
| driver.js | MIT | Excellent moteur de spotlight, mais popover en DOM vanilla, donc non thémable en MUI. |
| reactour | MIT | Peu maintenu. |
| Userpilot, Appcues, Pendo | Commerciales | Script tiers ayant accès à l'écran utilisateur. Écarté pour raisons RGPD et hébergement de données de santé. |

Aucune bibliothèque d'onboarding native MUI bien maintenue n'existe. C'est le
créneau visé.

Contrainte juridique : le code source d'Intro.js et de Shepherd.js ne doit
jamais être consulté pendant le développement, afin d'écarter tout risque de
contamination de licence. Les bibliothèques MIT citées peuvent être lues, et
leur code réutilisé avec attribution.

## 3. Décisions structurantes

Prises pendant la phase de conception, elles ne sont pas rouvertes sans raison
nouvelle.

1. **Cœur headless plus skin MUI**, dans un seul dépôt. Le cœur n'a aucune
   dépendance d'interface. La couche MUI est mince, ce qui isole la migration
   MUI 7 vers 9 en cours côté Qualiresolve.
2. **Configuration centrale et ancrage par attribut de données.** Un tour est un
   objet sérialisable. Une étape vise une clé logique, jamais un sélecteur CSS.
3. **Tours multi-pages avec navigation déléguée.** L'application fournit la
   fonction de navigation. Le cœur ne dépend d'aucun routeur.
4. **Dépôt public dès le premier commit**, sur l'organisation GitHub LogHosp.
5. **Télémétrie limitée à un rappel d'événements.** Le package n'émet aucune
   requête réseau et ne stocke rien de lui-même.
6. **Le tour d'abord, la checklist ensuite**, une fois le tour stable.

## 4. Nommage

| Élément | Nom |
|---|---|
| Dépôt | `guide` |
| Paquet cœur | `@guide/core` |
| Paquet MUI | `@guide/mui` |
| Attribut d'ancrage | `data-guide` |

Le nom `guide` seul est déjà publié sur npm. Le scope `@guide` ne contient
aucun paquet publié, et `@guide/core` comme `@guide/mui` sont libres. Si
l'organisation `@guide` se révèle déjà réservée au moment de la publication, le
repli est `@guidekit`, puis `@useguide`, tous deux vierges. Ni le nom du dépôt
ni l'API publique ne changent dans ce cas.

## 5. Architecture

### 5.1 Structure du dépôt

Monorepo pnpm, aligné sur la chaîne déjà utilisée par le front.

```
guide/
  packages/
    core/        @guide/core   — logique, aucune dépendance d'interface
    mui/         @guide/mui    — rendu MUI
  apps/
    demo/        vitrine Vite, terrain de test visuel et site public
  docs/
```

### 5.2 Répartition des responsabilités

`@guide/core` contient :

- la machine d'état d'un tour ;
- la résolution et l'observation des cibles ;
- le calcul du rectangle de spotlight et son suivi ;
- l'orchestration de la navigation entre pages ;
- l'accessibilité au clavier et pour les lecteurs d'écran ;
- le contrat de persistance et les implémentations mémoire et navigateur ;
- l'émission des événements.

Il exporte des hooks et des primitives non stylées, aucun composant visuel fini.

`@guide/mui` contient le popover, l'overlay, l'indicateur de progression, les
boutons, la checklist et les animations. Il dépend de `@guide/core` et de MUI en
peer dependency.

Le cœur ne connaît ni routeur, ni backend, ni langue. Tout élément spécifique
entre par les propriétés du fournisseur de contexte.

### 5.3 Les trois mécanismes qui portent la valeur

**Ancrage résilient.** Une cible est une clé logique. Le cœur la résout vers
l'élément portant l'attribut `data-guide` correspondant. Si la cible est
absente, un observateur de mutations attend son apparition, avec un délai
maximal configurable. Passé ce délai, le comportement dépend de la politique
choisie : `skip` passe à l'étape suivante, `wait` met le tour en pause, `error`
arrête le tour et émet un événement. Cette politique se règle globalement et
peut être surchargée par étape.

Une vérification au démarrage du tour signale en développement les cibles
déclarées qu'aucun élément ne porte, afin de détecter les tours cassés avant la
mise en production.

**Navigation déléguée.** Une étape peut déclarer la route sur laquelle elle
vit. Si l'emplacement courant ne correspond pas, le cœur appelle la fonction
`navigate` fournie par l'application, puis attend l'apparition de la cible avant
d'afficher l'étape. La correspondance de route accepte les segments
paramétrés. L'application fournit également la lecture de l'emplacement courant,
ce qui garde le cœur indépendant de Next comme de React Router.

**Spotlight.** Un overlay unique rendu en SVG, avec un masque découpé sur le
rectangle de la cible. Le rectangle est suivi au défilement et au
redimensionnement par un observateur, et animé en transition. Une étape peut
être déclarée interactive : la zone éclairée reste alors cliquable, ce qui
permet les tours où l'utilisateur agit réellement sur l'interface. Le
remplissage de l'overlay et le rayon d'arrondi sont pilotés par le thème dans la
couche MUI.

### 5.4 Flux de données

```
Déclaration du tour ──▶ GuideProvider ──▶ machine d'état
                                             │
                     ┌───────────────────────┼───────────────────────┐
                     ▼                       ▼                       ▼
              résolution cible        navigation route          persistance
                     │                       │                       │
                     ▼                       ▼                       ▼
               rectangle cible      navigate() applicatif     storage applicatif
                     │
                     ▼
              rendu @guide/mui  (overlay + popover ancré)
```

## 6. API publique

### 6.1 Déclaration d'un tour

```ts
export const dashboardTour: Tour = {
  id: 'dashboard',
  steps: [
    { target: 'nav.nc', titleKey: 'tour.dashboard.nav.title' },
    {
      target: 'nc.create',
      route: '/nc',
      placement: 'bottom',
      interactive: true,
      titleKey: 'tour.dashboard.create.title',
      bodyKey: 'tour.dashboard.create.body',
    },
  ],
}
```

Un tour est un objet de données pur. Il est sérialisable, traduisible et
relisible d'un coup d'œil.

### 6.2 Montage

```tsx
<GuideProvider
  tours={[dashboardTour]}
  navigate={(path) => router.push(path)}
  location={pathname}
  storage={backendStorage}
  translate={t}
  onEvent={track}
  onMissingTarget="wait"
>
  <App />
</GuideProvider>
```

### 6.3 Ancrage dans l'application

```tsx
<Button data-guide="nc.create">Nouvelle NC</Button>
```

Le code applicatif n'importe rien et ne change pas de structure. C'est la
condition pour que la bibliothèque reste adoptable sur du code existant.

### 6.4 Pilotage

```ts
const { start, next, previous, stop, complete, status, stepIndex } =
  useTour('dashboard')
```

### 6.5 Persistance

Une interface à deux méthodes, l'une pour lire l'état d'avancement, l'autre
pour l'écrire. Le paquet fournit une implémentation en mémoire et une
implémentation navigateur. Qualiresolve branchera la sienne sur le backend, ce
qui règle le cas des postes partagés en établissement, où le stockage local du
navigateur n'est pas fiable.

### 6.6 Traductions

Les textes ne sont jamais imposés. Une étape accepte soit une chaîne littérale,
soit une clé résolue par la fonction `translate` fournie au fournisseur.
i18next se branche en une ligne.

### 6.7 Événements

Le package émet des événements typés : tour démarré, étape affichée, étape
passée, tour abandonné, tour terminé, cible introuvable. L'application les
branche où elle veut. Aucune requête réseau n'est émise par la bibliothèque, et
aucune donnée ne sort. Il n'y a donc rien à justifier au titre du RGPD.

## 7. Accessibilité

Traitée dans le cœur, jamais en option.

- Le popover est une boîte de dialogue avec piège de focus.
- Le focus revient à son point d'origine à la fermeture.
- La touche d'échappement ferme le tour, les flèches naviguent entre les étapes.
- Les changements d'étape sont annoncés dans une région dynamique.
- La préférence système de mouvement réduit désactive les transitions.
- L'élément mis en avant reçoit une description accessible reliée au popover.

## 8. Gestion des erreurs

| Situation | Comportement |
|---|---|
| Cible absente au démarrage de l'étape | Attente par observateur, jusqu'au délai maximal. |
| Délai maximal dépassé | Politique `skip`, `wait` ou `error`, plus émission d'un événement. |
| Route déclarée mais pas de fonction `navigate` | Avertissement en développement, l'étape est traitée comme sans route. |
| Cible disparaissant pendant l'affichage | Le tour se met en pause et reprend au retour de la cible. |
| Tour déclaré avec un identifiant déjà utilisé | Erreur au montage du fournisseur. |
| Rendu côté serveur | Un garde empêche tout accès au DOM avant le montage client. |

## 9. Tests

- Cœur : tests unitaires avec Vitest et Testing Library, sur la machine d'état,
  la résolution de cible, la politique d'absence, la navigation et la
  persistance.
- Skin MUI : tests de rendu, plus tests visuels Playwright sur l'application de
  démonstration, en thème clair et sombre.
- Accessibilité : parcours clavier complet vérifié en test.
- Critère de succès de la première version : un tour multi-pages réel de
  Qualiresolve fonctionne de bout en bout, avec persistance backend et textes
  i18next.

## 10. Outillage et publication

- Monorepo pnpm, la même chaîne que le front Qualiresolve.
- Build avec tsup. Sorties ESM et CommonJS, types exportés.
- Peer dependencies larges : React 19, et MUI accepté en version 7 comme 9, afin
  que le paquet traverse la migration en cours sans rupture.
- Versionnage sémantique, changelog tenu, intégration continue sur
  l'organisation GitHub LogHosp.
- Dépôt public dès le premier commit.
- Licence MIT.

## 11. Périmètre

Dans la première version :

- le tour guidé complet, y compris multi-pages et étapes interactives ;
- le rendu MUI thémable, clair et sombre ;
- la persistance abstraite et ses deux implémentations fournies ;
- l'application de démonstration.

Dans un second temps, une fois le tour stable :

- la checklist de premiers pas, réutilisant le même contrat de persistance, avec
  la possibilité de déclencher un tour depuis un de ses éléments.

Hors du paquet public, et donc dans le front Qualiresolve :

- les tours concrets et leurs textes métier ;
- le filtrage par rôle et par section RBAC ;
- l'implémentation de persistance adossée au backend ;
- le wizard de configuration initiale d'un établissement.

Cette frontière est la règle qui protège le projet. Aucun rôle, aucune URL,
aucun texte métier Qualiresolve n'entre dans les paquets publiés.

## 12. Risques

| Risque | Réponse |
|---|---|
| Organisation `@guide` déjà réservée sur npm | Replis `@guidekit` puis `@useguide`, sans changement d'API. |
| Le dépôt public n'est pas maintenu | Périmètre volontairement réduit, et une première version dont Qualiresolve est le premier utilisateur, ce qui garantit un usage réel. |
| Du métier Qualiresolve se glisse dans le paquet | Le caractère public dès le premier commit rend la fuite visible, et l'application de démonstration ne connaît rien de Qualiresolve. |
| La migration MUI 7 vers 9 casse le skin | Le cœur est indépendant de MUI, et la couche MUI est mince. Tests visuels dans les deux versions. |
