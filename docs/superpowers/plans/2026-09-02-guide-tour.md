# Guide — Implementation Plan (tour guidé, version 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publier `@guide/core` et `@guide/mui`, une bibliothèque React d'onboarding dont la première version fournit un tour guidé multi-pages avec spotlight, entièrement thémable en MUI.

**Architecture:** Monorepo pnpm à deux paquets. `@guide/core` contient toute la logique (machine d'état, résolution de cible, suivi de rectangle, navigation déléguée, persistance abstraite, accessibilité) et ne dépend que de React. `@guide/mui` est une couche de rendu mince au-dessus du cœur, avec MUI en peer dependency. Une application de démonstration Vite sert de vitrine publique et de terrain de test end-to-end.

**Tech Stack:** TypeScript 5.9, React 19.2, MUI 7 et 9, pnpm 10, Vitest 3 avec jsdom, Testing Library, Playwright, tsup, Changesets, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-02-guide-onboarding-design.md`

## Global Constraints

- Node `>=22`, pnpm `>=10.6.5`. Le dépôt utilise pnpm exclusivement.
- Licence MIT sur tout le dépôt. Fichier `LICENSE` à la racine.
- **Interdiction absolue de consulter le code source d'Intro.js ou de Shepherd.js.** Licences AGPL ou commerciales, risque de contamination. Les bibliothèques MIT (driver.js, react-joyride, reactour) peuvent être lues, avec attribution si du code est repris.
- Aucun terme métier Qualiresolve dans `packages/` ni dans `apps/demo` : pas de rôle, pas d'URL applicative, pas de vocabulaire hospitalier. Le vocabulaire de démonstration est générique.
- `@guide/core` ne déclare aucune dépendance vers MUI, ni vers un routeur, ni vers une bibliothèque de traduction. Seule peer dependency : `react@^19`.
- `@guide/mui` déclare en peer dependencies `react@^19`, `@mui/material@^7 || ^9` et `@emotion/react@^11`, `@emotion/styled@^11`.
- Attribut d'ancrage : `data-guide`. Ce nom est figé, il fait partie de l'API publique.
- Les deux paquets sortent en ESM et CommonJS, avec types exportés, et portent la bannière `"use client"` pour rester utilisables dans le App Router de Next.
- Aucune requête réseau émise par les paquets. Aucun stockage effectué par le cœur en dehors des implémentations explicitement fournies.
- Tous les textes visibles des paquets sont fournis par le consommateur. Aucune chaîne en dur dans une langue donnée, hormis les messages d'erreur de développement, qui sont en anglais et préfixés `[guide]`.

**Précision par rapport à la spécification.** Le champ `route` d'une étape est un motif de correspondance, qui accepte des segments paramétrés. Un motif paramétré n'est pas une destination navigable. Une étape porte donc aussi un champ optionnel `navigateTo`, chemin concret utilisé pour la navigation. Quand `route` ne contient ni paramètre ni joker, il sert de destination par défaut.

---

## Structure des fichiers

```
guide/
  package.json                      racine du monorepo, scripts et outillage
  pnpm-workspace.yaml
  tsconfig.base.json
  LICENSE                           MIT
  README.md
  .github/workflows/ci.yml
  packages/
    core/
      package.json
      tsconfig.json
      tsup.config.ts
      vitest.config.ts
      src/
        types.ts                    Tour, Step, GuideEvent, GuideStorage, Rect
        storage.ts                  createMemoryStorage, createBrowserStorage
        matchRoute.ts               correspondance de motif de route
        tourMachine.ts              réducteur pur de la machine d'état
        useTargetElement.ts         résolution de cible et attente par observateur
        useElementRect.ts           suivi du rectangle de la cible
        a11y.ts                     useFocusTrap, useAnnouncer, usePrefersReducedMotion
        GuideProvider.tsx           contexte et orchestration
        useTour.ts                  API de pilotage
        useGuideStep.ts             API de rendu
        index.ts
      test/                         un fichier de test par module
    mui/
      package.json
      tsconfig.json
      tsup.config.ts
      vitest.config.ts
      src/
        Spotlight.tsx               overlay SVG à masque
        StepPopover.tsx             popover accessible
        GuideTour.tsx               assemblage
        index.ts
      test/
  apps/
    demo/                           vitrine Vite, multi-pages, clair et sombre
  e2e/                              scénarios Playwright sur la démo
  docs/
```

Chaque module du cœur a une responsabilité unique et se teste isolément. Le découpage suit la responsabilité, pas la couche technique.

---

## Task 1: Scaffolding du monorepo, types et persistance

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `LICENSE`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/test/setup.ts`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/storage.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/test/storage.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: les types `Rect`, `Step`, `Tour`, `TourProgress`, `GuideStorage`, `GuideEvent`, `MissingTargetPolicy`, `Translate`. Les fabriques `createMemoryStorage(initial?: Record<string, TourProgress>): GuideStorage` et `createBrowserStorage(namespace?: string): GuideStorage`. Toutes les tâches suivantes importent depuis `../src/types`.

- [ ] **Step 1: Créer le squelette du monorepo**

`package.json` :

```json
{
  "name": "guide-monorepo",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.20.0",
  "engines": { "node": ">=22", "pnpm": ">=10.6.5" },
  "scripts": {
    "build": "pnpm -r --filter \"./packages/*\" build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.0",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "jsdom": "^26.0.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "tsup": "^8.5.0",
    "typescript": "^5.9.0",
    "vitest": "^3.2.0"
  }
}
```

`pnpm-workspace.yaml` :

```yaml
packages:
  - packages/*
  - apps/*
```

`tsconfig.base.json` :

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true
  }
}
```

`LICENSE` : texte MIT standard, titulaire `LogHosp`, année `2026`.

`packages/core/package.json` :

```json
{
  "name": "@guide/core",
  "version": "0.0.0",
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": { "react": "^19" },
  "devDependencies": { "@types/react": "^19.2.0" }
}
```

`packages/core/tsconfig.json` :

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

`packages/core/vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
})
```

`packages/core/test/setup.ts` — jsdom ne fournit ni `ResizeObserver` ni `matchMedia`, les deux sont utilisés plus loin :

```ts
import '@testing-library/jest-dom/vitest'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
```

Ajouter `@testing-library/jest-dom` aux devDependencies racine, version `^6.6.0`.

- [ ] **Step 2: Écrire les types**

`packages/core/src/types.ts` :

```ts
export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export type MissingTargetPolicy = 'skip' | 'wait' | 'error'

export type Placement = 'top' | 'bottom' | 'left' | 'right'

export interface Step {
  /** Clé logique portée par l'attribut data-guide sur l'élément visé. */
  target: string
  /** Motif de route sur lequel l'étape est valide. Accepte :param et *. */
  route?: string
  /** Chemin concret vers lequel naviguer. Défaut : route si elle est littérale. */
  navigateTo?: string
  placement?: Placement
  /** Laisse l'utilisateur interagir avec la page pendant l'étape. */
  interactive?: boolean
  title?: string
  titleKey?: string
  body?: string
  bodyKey?: string
  /** Surcharge la politique globale pour cette étape. */
  onMissingTarget?: MissingTargetPolicy
}

export interface Tour {
  id: string
  steps: Step[]
}

export type TourStatus = 'idle' | 'running' | 'paused' | 'completed'

export interface TourProgress {
  status: 'in-progress' | 'completed'
  stepIndex: number
}

export interface GuideStorage {
  read(tourId: string): Promise<TourProgress | null>
  write(tourId: string, progress: TourProgress): Promise<void>
}

export type GuideEvent =
  | { type: 'tour:start'; tourId: string; stepIndex: number }
  | { type: 'tour:complete'; tourId: string }
  | { type: 'tour:stop'; tourId: string; stepIndex: number }
  | { type: 'step:show'; tourId: string; stepIndex: number; target: string }
  | { type: 'target:missing'; tourId: string; stepIndex: number; target: string }

export type Translate = (key: string) => string
```

- [ ] **Step 3: Écrire le test de persistance, qui doit échouer**

`packages/core/test/storage.test.ts` :

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { createMemoryStorage, createBrowserStorage } from '../src/storage'

describe('createMemoryStorage', () => {
  it('renvoie null pour un tour inconnu', async () => {
    const storage = createMemoryStorage()
    expect(await storage.read('unknown')).toBeNull()
  })

  it('relit ce qui a été écrit', async () => {
    const storage = createMemoryStorage()
    await storage.write('a', { status: 'in-progress', stepIndex: 2 })
    expect(await storage.read('a')).toEqual({ status: 'in-progress', stepIndex: 2 })
  })

  it('accepte un état initial', async () => {
    const storage = createMemoryStorage({ a: { status: 'completed', stepIndex: 4 } })
    expect(await storage.read('a')).toEqual({ status: 'completed', stepIndex: 4 })
  })
})

describe('createBrowserStorage', () => {
  beforeEach(() => window.localStorage.clear())

  it('persiste dans localStorage sous un espace de noms', async () => {
    const storage = createBrowserStorage('demo')
    await storage.write('a', { status: 'in-progress', stepIndex: 1 })
    expect(window.localStorage.getItem('demo:a')).toBe(
      JSON.stringify({ status: 'in-progress', stepIndex: 1 }),
    )
    expect(await storage.read('a')).toEqual({ status: 'in-progress', stepIndex: 1 })
  })

  it('renvoie null quand la valeur stockée est illisible', async () => {
    window.localStorage.setItem('demo:a', 'pas du json')
    const storage = createBrowserStorage('demo')
    expect(await storage.read('a')).toBeNull()
  })
})
```

- [ ] **Step 4: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter @guide/core test`
Expected: FAIL, `Failed to resolve import "../src/storage"`.

- [ ] **Step 5: Implémenter la persistance**

`packages/core/src/storage.ts` :

```ts
import type { GuideStorage, TourProgress } from './types'

export function createMemoryStorage(
  initial: Record<string, TourProgress> = {},
): GuideStorage {
  const store = new Map<string, TourProgress>(Object.entries(initial))
  return {
    async read(tourId) {
      return store.get(tourId) ?? null
    },
    async write(tourId, progress) {
      store.set(tourId, progress)
    },
  }
}

export function createBrowserStorage(namespace = 'guide'): GuideStorage {
  const key = (tourId: string) => `${namespace}:${tourId}`
  const available = () => typeof window !== 'undefined' && !!window.localStorage

  return {
    async read(tourId) {
      if (!available()) return null
      try {
        const raw = window.localStorage.getItem(key(tourId))
        return raw ? (JSON.parse(raw) as TourProgress) : null
      } catch {
        return null
      }
    },
    async write(tourId, progress) {
      if (!available()) return
      try {
        window.localStorage.setItem(key(tourId), JSON.stringify(progress))
      } catch {
        // quota dépassé ou stockage bloqué : la persistance est optionnelle
      }
    },
  }
}
```

`packages/core/src/index.ts` :

```ts
export * from './types'
export * from './storage'
```

- [ ] **Step 6: Lancer le test et vérifier qu'il passe**

Run: `pnpm --filter @guide/core test`
Expected: PASS, cinq tests.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json LICENSE packages/core
git commit -m "feat(core): types publics et implémentations de persistance"
```

---

## Task 2: Correspondance de route

**Files:**
- Create: `packages/core/src/matchRoute.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/matchRoute.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `matchRoute(pattern: string, pathname: string): boolean` et `isLiteralRoute(pattern: string): boolean`. La tâche 7 utilise les deux.

- [ ] **Step 1: Écrire le test, qui doit échouer**

`packages/core/test/matchRoute.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { matchRoute, isLiteralRoute } from '../src/matchRoute'

describe('matchRoute', () => {
  it('accepte une correspondance exacte', () => {
    expect(matchRoute('/nc', '/nc')).toBe(true)
  })

  it('refuse un chemin différent', () => {
    expect(matchRoute('/nc', '/audit')).toBe(false)
  })

  it('refuse un chemin plus profond que le motif', () => {
    expect(matchRoute('/nc', '/nc/123')).toBe(false)
  })

  it('accepte un segment paramétré', () => {
    expect(matchRoute('/nc/:id', '/nc/123')).toBe(true)
  })

  it('refuse un segment paramétré vide', () => {
    expect(matchRoute('/nc/:id', '/nc/')).toBe(false)
  })

  it('accepte un joker en fin de motif', () => {
    expect(matchRoute('/nc/*', '/nc/123/details')).toBe(true)
  })

  it('ignore la barre oblique finale', () => {
    expect(matchRoute('/nc/', '/nc')).toBe(true)
  })

  it('ignore la chaîne de requête', () => {
    expect(matchRoute('/nc', '/nc?page=2')).toBe(true)
  })

  it('gère la racine', () => {
    expect(matchRoute('/', '/')).toBe(true)
    expect(matchRoute('/', '/nc')).toBe(false)
  })
})

describe('isLiteralRoute', () => {
  it('reconnaît un motif littéral', () => {
    expect(isLiteralRoute('/nc')).toBe(true)
  })

  it('rejette un motif paramétré ou joker', () => {
    expect(isLiteralRoute('/nc/:id')).toBe(false)
    expect(isLiteralRoute('/nc/*')).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter @guide/core test matchRoute`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Implémenter**

`packages/core/src/matchRoute.ts` :

```ts
function segments(value: string): string[] {
  const path = value.split('?')[0] ?? ''
  const trimmed = path.replace(/\/+$/, '')
  return (trimmed === '' ? '/' : trimmed).split('/')
}

export function isLiteralRoute(pattern: string): boolean {
  return !pattern.includes(':') && !pattern.includes('*')
}

export function matchRoute(pattern: string, pathname: string): boolean {
  const expected = segments(pattern)
  const actual = segments(pathname)

  for (let index = 0; index < expected.length; index += 1) {
    const segment = expected[index]
    if (segment === '*') return true

    const candidate = actual[index]
    if (candidate === undefined) return false

    if (segment?.startsWith(':')) {
      if (candidate === '') return false
      continue
    }

    if (segment !== candidate) return false
  }

  return expected.length === actual.length
}
```

- [ ] **Step 4: Exporter et vérifier**

Ajouter à `packages/core/src/index.ts` :

```ts
export * from './matchRoute'
```

Run: `pnpm --filter @guide/core test`
Expected: PASS, tous les tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/matchRoute.ts packages/core/src/index.ts packages/core/test/matchRoute.test.ts
git commit -m "feat(core): correspondance de motif de route"
```

---

## Task 3: Machine d'état du tour

**Files:**
- Create: `packages/core/src/tourMachine.ts`
- Test: `packages/core/test/tourMachine.test.ts`

**Interfaces:**
- Consumes: `TourStatus` depuis `./types`.
- Produces: `TourState { tourId: string | null; stepIndex: number; status: TourStatus }`, `initialTourState`, `TourAction`, `tourReducer(state, action)`. La tâche 7 les consomme. Le réducteur reste pur : aucun effet, aucun accès au DOM.

- [ ] **Step 1: Écrire le test, qui doit échouer**

`packages/core/test/tourMachine.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { initialTourState, tourReducer } from '../src/tourMachine'

describe('tourReducer', () => {
  it('démarre un tour à la première étape', () => {
    const state = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 0 })
    expect(state).toEqual({ tourId: 'a', stepIndex: 0, status: 'running' })
  })

  it('démarre à une étape donnée', () => {
    const state = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 3 })
    expect(state.stepIndex).toBe(3)
  })

  it('avance d une étape', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 0 })
    const state = tourReducer(started, { type: 'NEXT', stepCount: 3 })
    expect(state).toEqual({ tourId: 'a', stepIndex: 1, status: 'running' })
  })

  it('termine le tour après la dernière étape', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 2 })
    const state = tourReducer(started, { type: 'NEXT', stepCount: 3 })
    expect(state).toEqual({ tourId: 'a', stepIndex: 2, status: 'completed' })
  })

  it('recule sans passer sous zéro', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 0 })
    expect(tourReducer(started, { type: 'PREVIOUS' }).stepIndex).toBe(0)
  })

  it('met en pause puis reprend', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 1 })
    const paused = tourReducer(started, { type: 'PAUSE' })
    expect(paused.status).toBe('paused')
    expect(tourReducer(paused, { type: 'RESUME' }).status).toBe('running')
  })

  it('ne reprend pas un tour terminé', () => {
    const completed = { tourId: 'a', stepIndex: 2, status: 'completed' as const }
    expect(tourReducer(completed, { type: 'RESUME' })).toBe(completed)
  })

  it('arrête et revient à l état initial', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 1 })
    expect(tourReducer(started, { type: 'STOP' })).toEqual(initialTourState)
  })

  it('ignore une action de progression quand aucun tour ne tourne', () => {
    expect(tourReducer(initialTourState, { type: 'NEXT', stepCount: 3 })).toBe(initialTourState)
  })
})
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter @guide/core test tourMachine`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Implémenter**

`packages/core/src/tourMachine.ts` :

```ts
import type { TourStatus } from './types'

export interface TourState {
  tourId: string | null
  stepIndex: number
  status: TourStatus
}

export type TourAction =
  | { type: 'START'; tourId: string; stepIndex: number }
  | { type: 'NEXT'; stepCount: number }
  | { type: 'PREVIOUS' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }

export const initialTourState: TourState = {
  tourId: null,
  stepIndex: 0,
  status: 'idle',
}

export function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case 'START':
      return { tourId: action.tourId, stepIndex: action.stepIndex, status: 'running' }

    case 'NEXT': {
      if (state.status !== 'running' && state.status !== 'paused') return state
      const isLast = state.stepIndex >= action.stepCount - 1
      return isLast
        ? { ...state, status: 'completed' }
        : { ...state, stepIndex: state.stepIndex + 1, status: 'running' }
    }

    case 'PREVIOUS':
      if (state.status !== 'running' && state.status !== 'paused') return state
      return { ...state, stepIndex: Math.max(0, state.stepIndex - 1), status: 'running' }

    case 'PAUSE':
      return state.status === 'running' ? { ...state, status: 'paused' } : state

    case 'RESUME':
      return state.status === 'paused' ? { ...state, status: 'running' } : state

    case 'STOP':
      return initialTourState

    default:
      return state
  }
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `pnpm --filter @guide/core test tourMachine`
Expected: PASS, neuf tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tourMachine.ts packages/core/test/tourMachine.test.ts
git commit -m "feat(core): machine d'état du tour"
```

---

## Task 4: Résolution de cible avec attente

**Files:**
- Create: `packages/core/src/useTargetElement.ts`
- Test: `packages/core/test/useTargetElement.test.tsx`

**Interfaces:**
- Consumes: rien.
- Produces: `useTargetElement(target: string | null, options?: { timeoutMs?: number; attribute?: string }): { element: HTMLElement | null; timedOut: boolean }`. La tâche 7 l'appelle avec la cible de l'étape courante.

- [ ] **Step 1: Écrire le test, qui doit échouer**

`packages/core/test/useTargetElement.test.tsx` :

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { useTargetElement } from '../src/useTargetElement'

function Anchor({ id }: { id: string }) {
  return <button data-guide={id}>cible</button>
}

describe('useTargetElement', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('résout une cible déjà présente', async () => {
    render(<Anchor id="create" />)
    const { result } = renderHook(() => useTargetElement('create'))
    await waitFor(() => expect(result.current.element).not.toBeNull())
    expect(result.current.element?.tagName).toBe('BUTTON')
    expect(result.current.timedOut).toBe(false)
  })

  it('ne résout rien quand la cible est nulle', () => {
    const { result } = renderHook(() => useTargetElement(null))
    expect(result.current.element).toBeNull()
  })

  it('attend l apparition tardive de la cible', async () => {
    const { result } = renderHook(() => useTargetElement('late'))
    expect(result.current.element).toBeNull()

    const host = document.createElement('div')
    document.body.appendChild(host)
    const view = render(<Anchor id="late" />, { container: host })

    await waitFor(() => expect(result.current.element).not.toBeNull())
    view.unmount()
  })

  it('signale le dépassement du délai', async () => {
    const { result } = renderHook(() => useTargetElement('never', { timeoutMs: 1000 }))
    await act(async () => {
      vi.advanceTimersByTime(1200)
    })
    expect(result.current.timedOut).toBe(true)
    expect(result.current.element).toBeNull()
  })

  it('échappe les guillemets dans la clé de cible', async () => {
    render(<Anchor id={'a"b'} />)
    const { result } = renderHook(() => useTargetElement('a"b'))
    await waitFor(() => expect(result.current.element).not.toBeNull())
  })
})
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter @guide/core test useTargetElement`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Implémenter**

`packages/core/src/useTargetElement.ts` :

```ts
import { useEffect, useState } from 'react'

const DEFAULT_TIMEOUT_MS = 5000

function escapeAttributeValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/["\\]/g, '\\$&')
}

export interface UseTargetElementOptions {
  timeoutMs?: number
  attribute?: string
}

export function useTargetElement(
  target: string | null,
  options: UseTargetElementOptions = {},
): { element: HTMLElement | null; timedOut: boolean } {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, attribute = 'data-guide' } = options
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    setElement(null)
    setTimedOut(false)
    if (!target || typeof document === 'undefined') return

    const selector = `[${attribute}="${escapeAttributeValue(target)}"]`
    const find = () => document.querySelector<HTMLElement>(selector)

    const found = find()
    if (found) {
      setElement(found)
      return
    }

    let timer: ReturnType<typeof setTimeout> | undefined

    const observer = new MutationObserver(() => {
      const candidate = find()
      if (!candidate) return
      observer.disconnect()
      if (timer) clearTimeout(timer)
      setElement(candidate)
    })

    observer.observe(document.body, { childList: true, subtree: true, attributes: true })

    timer = setTimeout(() => {
      observer.disconnect()
      setTimedOut(true)
    }, timeoutMs)

    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [target, timeoutMs, attribute])

  return { element, timedOut }
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `pnpm --filter @guide/core test useTargetElement`
Expected: PASS, cinq tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/useTargetElement.ts packages/core/test/useTargetElement.test.tsx
git commit -m "feat(core): résolution de cible avec attente par observateur"
```

---

## Task 5: Suivi du rectangle de la cible

**Files:**
- Create: `packages/core/src/useElementRect.ts`
- Test: `packages/core/test/useElementRect.test.tsx`

**Interfaces:**
- Consumes: `Rect` depuis `./types`.
- Produces: `useElementRect(element: HTMLElement | null): Rect | null`. Le rectangle est exprimé en coordonnées de fenêtre, ce qui correspond à un overlay en position fixe. La référence retournée reste stable tant que les valeurs ne changent pas, afin d'éviter les rendus inutiles.

- [ ] **Step 1: Écrire le test, qui doit échouer**

`packages/core/test/useElementRect.test.tsx` :

```tsx
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useElementRect } from '../src/useElementRect'

function anchorWithRect(rect: { top: number; left: number; width: number; height: number }) {
  const element = document.createElement('div')
  document.body.appendChild(element)
  element.getBoundingClientRect = vi.fn(() => ({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  })) as unknown as HTMLElement['getBoundingClientRect']
  return element
}

describe('useElementRect', () => {
  it('renvoie null sans élément', () => {
    const { result } = renderHook(() => useElementRect(null))
    expect(result.current).toBeNull()
  })

  it('mesure l élément au montage', () => {
    const element = anchorWithRect({ top: 10, left: 20, width: 100, height: 40 })
    const { result } = renderHook(() => useElementRect(element))
    expect(result.current).toEqual({ top: 10, left: 20, width: 100, height: 40 })
  })

  it('remesure au défilement', () => {
    const element = anchorWithRect({ top: 10, left: 20, width: 100, height: 40 })
    const { result } = renderHook(() => useElementRect(element))

    element.getBoundingClientRect = vi.fn(() => ({
      top: 0, left: 20, width: 100, height: 40,
      right: 120, bottom: 40, x: 20, y: 0, toJSON: () => ({}),
    })) as unknown as HTMLElement['getBoundingClientRect']

    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(result.current?.top).toBe(0)
  })

  it('garde la même référence quand rien ne change', () => {
    const element = anchorWithRect({ top: 10, left: 20, width: 100, height: 40 })
    const { result } = renderHook(() => useElementRect(element))
    const first = result.current
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toBe(first)
  })
})
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter @guide/core test useElementRect`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Implémenter**

`packages/core/src/useElementRect.ts` :

```ts
import { useEffect, useState } from 'react'
import type { Rect } from './types'

function sameRect(a: Rect, b: DOMRect): boolean {
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}

export function useElementRect(element: HTMLElement | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    if (!element) {
      setRect(null)
      return
    }

    const measure = () => {
      const next = element.getBoundingClientRect()
      setRect((previous) =>
        previous && sameRect(previous, next)
          ? previous
          : { top: next.top, left: next.left, width: next.width, height: next.height },
      )
    }

    measure()

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(element)

    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)

    return () => {
      observer?.disconnect()
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [element])

  return rect
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `pnpm --filter @guide/core test useElementRect`
Expected: PASS, quatre tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/useElementRect.ts packages/core/test/useElementRect.test.tsx
git commit -m "feat(core): suivi du rectangle de la cible"
```

---

## Task 6: Primitives d'accessibilité

**Files:**
- Create: `packages/core/src/a11y.ts`
- Test: `packages/core/test/a11y.test.tsx`

**Interfaces:**
- Consumes: rien.
- Produces: `useFocusTrap(container: HTMLElement | null, active: boolean): void`, `useAnnouncer(): (message: string) => void`, `usePrefersReducedMotion(): boolean`. La tâche 9 utilise le piège de focus dans le popover, la tâche 7 utilise l'annonceur au changement d'étape, la tâche 8 utilise la préférence de mouvement.

Ces primitives vivent dans le cœur parce que la spécification place l'accessibilité dans le cœur, jamais en option de la couche visuelle. Elles évitent aussi de dépendre d'une API MUI dont le nom diffère entre les versions 7 et 9.

- [ ] **Step 1: Écrire le test, qui doit échouer**

`packages/core/test/a11y.test.tsx` :

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAnnouncer, useFocusTrap, usePrefersReducedMotion } from '../src/a11y'
import { useEffect, useRef, useState } from 'react'

function Trapped() {
  const ref = useRef<HTMLDivElement>(null)
  const [node, setNode] = useState<HTMLElement | null>(null)
  useEffect(() => setNode(ref.current), [])
  useFocusTrap(node, true)
  return (
    <div ref={ref}>
      <button>premier</button>
      <button>second</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('donne le focus au premier élément focalisable', async () => {
    render(<Trapped />)
    expect(await screen.findByText('premier')).toHaveFocus()
  })

  it('boucle du dernier vers le premier avec Tab', async () => {
    const user = userEvent.setup()
    render(<Trapped />)
    await screen.findByText('premier')
    await user.tab()
    expect(screen.getByText('second')).toHaveFocus()
    await user.tab()
    expect(screen.getByText('premier')).toHaveFocus()
  })

  it('rend le focus à l élément d origine', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()

    const view = render(<Trapped />)
    await screen.findByText('premier')
    view.unmount()
    expect(document.activeElement).toBe(outside)
  })
})

describe('useAnnouncer', () => {
  it('écrit dans une région dynamique polie', () => {
    const { result } = renderHook(() => useAnnouncer())
    result.current('étape 2 sur 3')
    const region = document.querySelector('[data-guide-announcer]')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent('étape 2 sur 3')
  })
})

describe('usePrefersReducedMotion', () => {
  it('suit la requête média', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: true,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    )
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(true)
  })
})
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter @guide/core test a11y`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Implémenter**

`packages/core/src/a11y.ts` :

```ts
import { useCallback, useEffect, useState } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(container: HTMLElement | null, active: boolean): void {
  useEffect(() => {
    if (!container || !active) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      )

    const first = focusable()[0]
    if (first) first.focus()
    else container.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (elements.length === 0) return

      const firstElement = elements[0]!
      const lastElement = elements[elements.length - 1]!

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previouslyFocused?.focus?.()
    }
  }, [container, active])
}

function announcerNode(): HTMLElement {
  const existing = document.querySelector<HTMLElement>('[data-guide-announcer]')
  if (existing) return existing

  const node = document.createElement('div')
  node.setAttribute('data-guide-announcer', '')
  node.setAttribute('aria-live', 'polite')
  node.setAttribute('aria-atomic', 'true')
  node.style.position = 'absolute'
  node.style.width = '1px'
  node.style.height = '1px'
  node.style.overflow = 'hidden'
  node.style.clip = 'rect(0 0 0 0)'
  node.style.whiteSpace = 'nowrap'
  document.body.appendChild(node)
  return node
}

export function useAnnouncer(): (message: string) => void {
  return useCallback((message: string) => {
    if (typeof document === 'undefined') return
    announcerNode().textContent = message
  }, [])
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `pnpm --filter @guide/core test a11y`
Expected: PASS, cinq tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/a11y.ts packages/core/test/a11y.test.tsx
git commit -m "feat(core): piège de focus, annonceur et préférence de mouvement"
```

---

## Task 7: Fournisseur de contexte et API publique

**Files:**
- Create: `packages/core/src/GuideProvider.tsx`
- Create: `packages/core/src/useTour.ts`
- Create: `packages/core/src/useGuideStep.ts`
- Create: `packages/core/src/validateTour.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/GuideProvider.test.tsx`
- Test: `packages/core/test/validateTour.test.ts`

**Interfaces:**
- Consumes: `tourReducer`, `initialTourState`, `TourState` (tâche 3) ; `matchRoute`, `isLiteralRoute` (tâche 2) ; `useTargetElement` (tâche 4) ; `useElementRect` (tâche 5) ; `useAnnouncer` (tâche 6) ; les types de la tâche 1.
- Produces:
  - `findMissingTargets(tour: Tour, location: string | undefined, attribute?: string): string[]`
  - `GuideProvider(props: GuideProviderProps)`
  - `useTour(tourId: string): { start: (options?: { from?: number; resume?: boolean }) => Promise<void>; next: () => void; previous: () => void; stop: () => void; status: TourStatus; stepIndex: number }`
  - `useGuideStep(): ActiveStep | null` où
    `ActiveStep = { tourId: string; step: Step; stepIndex: number; stepCount: number; element: HTMLElement | null; rect: Rect | null; title: string; body: string; isFirst: boolean; isLast: boolean; next: () => void; previous: () => void; stop: () => void }`
  Les tâches 8, 9 et 10 consomment `useGuideStep`. La tâche 11 consomme `useTour`.

- [ ] **Step 1: Écrire le test, qui doit échouer**

`packages/core/test/GuideProvider.test.tsx` :

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { GuideProvider } from '../src/GuideProvider'
import { useTour } from '../src/useTour'
import { useGuideStep } from '../src/useGuideStep'
import { createMemoryStorage } from '../src/storage'
import type { GuideEvent, Tour } from '../src/types'

const tour: Tour = {
  id: 'demo',
  steps: [
    { target: 'one', title: 'Première' },
    { target: 'two', title: 'Deuxième' },
  ],
}

function StepReadout() {
  const active = useGuideStep()
  if (!active) return <p>aucune étape</p>
  return (
    <div>
      <p>{active.title}</p>
      <p>{`${active.stepIndex + 1}/${active.stepCount}`}</p>
      <button onClick={active.next}>suivant</button>
      <button onClick={active.stop}>arrêter</button>
    </div>
  )
}

function Starter() {
  const { start, status } = useTour('demo')
  return (
    <>
      <button onClick={() => void start()}>démarrer</button>
      <span>{status}</span>
    </>
  )
}

function Harness(props: Partial<React.ComponentProps<typeof GuideProvider>> = {}) {
  return (
    <GuideProvider tours={[tour]} {...props}>
      <button data-guide="one">un</button>
      <button data-guide="two">deux</button>
      <Starter />
      <StepReadout />
    </GuideProvider>
  )
}

describe('GuideProvider', () => {
  it('n affiche aucune étape avant le démarrage', () => {
    render(<Harness />)
    expect(screen.getByText('aucune étape')).toBeInTheDocument()
  })

  it('démarre le tour et expose la première étape', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('démarrer'))
    expect(await screen.findByText('Première')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('avance puis termine le tour', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('démarrer'))
    await screen.findByText('Première')
    await user.click(screen.getByText('suivant'))
    expect(await screen.findByText('Deuxième')).toBeInTheDocument()
    await user.click(screen.getByText('suivant'))
    await waitFor(() => expect(screen.getByText('completed')).toBeInTheDocument())
  })

  it('résout l élément cible et son rectangle', async () => {
    const user = userEvent.setup()
    function RectReadout() {
      const active = useGuideStep()
      return <span>{active?.element?.textContent ?? 'rien'}</span>
    }
    render(
      <GuideProvider tours={[tour]}>
        <button data-guide="one">un</button>
        <Starter />
        <RectReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('démarrer'))
    await waitFor(() => expect(screen.getByText('un')).toBeInTheDocument())
  })

  it('émet les événements du cycle de vie', async () => {
    const user = userEvent.setup()
    const events: GuideEvent[] = []
    render(<Harness onEvent={(event) => events.push(event)} />)
    await user.click(screen.getByText('démarrer'))
    await screen.findByText('Première')
    await user.click(screen.getByText('suivant'))
    await screen.findByText('Deuxième')
    await user.click(screen.getByText('suivant'))

    await waitFor(() =>
      expect(events.map((event) => event.type)).toEqual(
        expect.arrayContaining(['tour:start', 'step:show', 'tour:complete']),
      ),
    )
  })

  it('reprend à l étape enregistrée', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage({ demo: { status: 'in-progress', stepIndex: 1 } })
    render(<Harness storage={storage} />)
    await user.click(screen.getByText('démarrer'))
    expect(await screen.findByText('Deuxième')).toBeInTheDocument()
  })

  it('écrit la progression dans la persistance', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    render(<Harness storage={storage} />)
    await user.click(screen.getByText('démarrer'))
    await screen.findByText('Première')
    await waitFor(async () =>
      expect(await storage.read('demo')).toEqual({ status: 'in-progress', stepIndex: 0 }),
    )
  })

  it('traduit les clés de texte', async () => {
    const user = userEvent.setup()
    const translated: Tour = { id: 'demo', steps: [{ target: 'one', titleKey: 'a.title' }] }
    render(
      <GuideProvider tours={[translated]} translate={(key) => `traduit:${key}`}>
        <button data-guide="one">un</button>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('démarrer'))
    expect(await screen.findByText('traduit:a.title')).toBeInTheDocument()
  })

  it('navigue quand l étape vit sur une autre route', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const routed: Tour = { id: 'demo', steps: [{ target: 'one', route: '/other' }] }
    render(
      <GuideProvider tours={[routed]} location="/" navigate={navigate}>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('démarrer'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/other'))
  })

  it('utilise navigateTo quand la route est paramétrée', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const routed: Tour = {
      id: 'demo',
      steps: [{ target: 'one', route: '/item/:id', navigateTo: '/item/42' }],
    }
    render(
      <GuideProvider tours={[routed]} location="/" navigate={navigate}>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('démarrer'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/item/42'))
  })

  it('saute l étape quand la cible manque et que la politique est skip', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const partial: Tour = {
      id: 'demo',
      steps: [
        { target: 'absent', title: 'Première' },
        { target: 'two', title: 'Deuxième' },
      ],
    }
    render(
      <GuideProvider tours={[partial]} onMissingTarget="skip" targetTimeoutMs={500}>
        <button data-guide="two">deux</button>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('démarrer'))
    await vi.advanceTimersByTimeAsync(800)
    expect(await screen.findByText('Deuxième')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('avertit en développement quand une cible attendue sur la page courante manque', async () => {
    const user = userEvent.setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const partial: Tour = {
      id: 'demo',
      steps: [
        { target: 'one', route: '/', title: 'Première' },
        { target: 'absent', route: '/', title: 'Deuxième' },
      ],
    }
    render(
      <GuideProvider tours={[partial]} location="/">
        <button data-guide="one">un</button>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('démarrer'))
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('absent')),
    )
    warn.mockRestore()
  })

  it('refuse deux tours portant le même identifiant', () => {
    const duplicate: Tour = { id: 'demo', steps: [] }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <GuideProvider tours={[tour, duplicate]}>
          <span />
        </GuideProvider>,
      ),
    ).toThrow(/duplicate tour id/)
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter @guide/core test GuideProvider`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Implémenter la vérification des cibles**

La spécification demande qu'une vérification au démarrage signale en développement
les cibles déclarées qu'aucun élément ne porte. Seules les étapes attendues sur la
page courante sont vérifiables, celles des autres pages ne sont pas encore montées.

`packages/core/test/validateTour.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { findMissingTargets } from '../src/validateTour'
import type { Tour } from '../src/types'

const tour: Tour = {
  id: 'demo',
  steps: [
    { target: 'present', route: '/' },
    { target: 'absent', route: '/' },
    { target: 'elsewhere', route: '/other' },
    { target: 'no-route' },
  ],
}

describe('findMissingTargets', () => {
  it('ne signale que les cibles attendues sur la page courante', () => {
    document.body.innerHTML = '<button data-guide="present"></button>'
    expect(findMissingTargets(tour, '/')).toEqual(['absent', 'no-route'])
  })

  it('ne signale rien quand tout est présent', () => {
    document.body.innerHTML =
      '<button data-guide="present"></button><button data-guide="absent"></button><button data-guide="no-route"></button>'
    expect(findMissingTargets(tour, '/')).toEqual([])
  })

  it('vérifie toutes les étapes quand aucune position n est fournie', () => {
    document.body.innerHTML = ''
    expect(findMissingTargets(tour, undefined)).toEqual([
      'present',
      'absent',
      'elsewhere',
      'no-route',
    ])
  })
})
```

`packages/core/src/validateTour.ts` :

```ts
import type { Tour } from './types'
import { matchRoute } from './matchRoute'

export function findMissingTargets(
  tour: Tour,
  location: string | undefined,
  attribute = 'data-guide',
): string[] {
  if (typeof document === 'undefined') return []

  return tour.steps
    .filter((step) => !step.route || location === undefined || matchRoute(step.route, location))
    .map((step) => step.target)
    .filter((target) => !document.querySelector(`[${attribute}="${target}"]`))
}
```

Run: `pnpm --filter @guide/core test validateTour`
Expected: PASS, trois tests.

- [ ] **Step 4: Implémenter le fournisseur**

`packages/core/src/GuideProvider.tsx` :

```tsx
'use client'

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import type {
  GuideEvent,
  GuideStorage,
  MissingTargetPolicy,
  Rect,
  Step,
  Tour,
  TourStatus,
  Translate,
} from './types'
import { initialTourState, tourReducer, type TourState } from './tourMachine'
import { isLiteralRoute, matchRoute } from './matchRoute'
import { useTargetElement } from './useTargetElement'
import { useElementRect } from './useElementRect'
import { useAnnouncer } from './a11y'
import { findMissingTargets } from './validateTour'

export interface ActiveStep {
  tourId: string
  step: Step
  stepIndex: number
  stepCount: number
  element: HTMLElement | null
  rect: Rect | null
  title: string
  body: string
  isFirst: boolean
  isLast: boolean
  next: () => void
  previous: () => void
  stop: () => void
}

export interface GuideContextValue {
  state: TourState
  activeStep: ActiveStep | null
  start: (tourId: string, options?: { from?: number; resume?: boolean }) => Promise<void>
  next: () => void
  previous: () => void
  stop: () => void
}

export const GuideContext = createContext<GuideContextValue | null>(null)

export interface GuideProviderProps {
  tours: Tour[]
  children: ReactNode
  navigate?: (path: string) => void
  location?: string
  storage?: GuideStorage
  translate?: Translate
  onEvent?: (event: GuideEvent) => void
  onMissingTarget?: MissingTargetPolicy
  targetTimeoutMs?: number
}

function resolveText(
  value: string | undefined,
  key: string | undefined,
  translate: Translate | undefined,
): string {
  if (value !== undefined) return value
  if (key === undefined) return ''
  return translate ? translate(key) : key
}

export function GuideProvider({
  tours,
  children,
  navigate,
  location,
  storage,
  translate,
  onEvent,
  onMissingTarget = 'wait',
  targetTimeoutMs = 5000,
}: GuideProviderProps) {
  const toursById = useMemo(() => {
    const map = new Map<string, Tour>()
    for (const candidate of tours) {
      if (map.has(candidate.id)) {
        throw new Error(`[guide] duplicate tour id: ${candidate.id}`)
      }
      map.set(candidate.id, candidate)
    }
    return map
  }, [tours])

  const [state, dispatch] = useReducer(tourReducer, initialTourState)
  const announce = useAnnouncer()

  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const emit = useCallback((event: GuideEvent) => onEventRef.current?.(event), [])

  const tour = state.tourId ? (toursById.get(state.tourId) ?? null) : null
  const step = tour ? (tour.steps[state.stepIndex] ?? null) : null
  const isActive = state.status === 'running' || state.status === 'paused'

  const routeMatches =
    !step?.route || location === undefined || matchRoute(step.route, location)

  const { element, timedOut } = useTargetElement(
    isActive && routeMatches && step ? step.target : null,
    { timeoutMs: targetTimeoutMs },
  )
  const rect = useElementRect(element)

  const next = useCallback(() => {
    if (!tour) return
    const isLast = state.stepIndex >= tour.steps.length - 1
    dispatch({ type: 'NEXT', stepCount: tour.steps.length })
    if (isLast) emit({ type: 'tour:complete', tourId: tour.id })
  }, [tour, state.stepIndex, emit])

  const previous = useCallback(() => dispatch({ type: 'PREVIOUS' }), [])

  const stop = useCallback(() => {
    if (tour) emit({ type: 'tour:stop', tourId: tour.id, stepIndex: state.stepIndex })
    dispatch({ type: 'STOP' })
  }, [tour, state.stepIndex, emit])

  const start = useCallback(
    async (tourId: string, options?: { from?: number; resume?: boolean }) => {
      const target = toursById.get(tourId)
      if (!target) throw new Error(`[guide] unknown tour: ${tourId}`)

      let stepIndex = options?.from ?? 0
      if (options?.from === undefined && options?.resume !== false && storage) {
        const progress = await storage.read(tourId)
        if (progress?.status === 'in-progress') stepIndex = progress.stepIndex
      }

      if (process.env.NODE_ENV !== 'production') {
        const missing = findMissingTargets(target, location)
        if (missing.length > 0) {
          console.warn(
            `[guide] tour "${tourId}" declares targets that are not present on this page: ${missing.join(', ')}`,
          )
        }
      }

      dispatch({ type: 'START', tourId, stepIndex })
      emit({ type: 'tour:start', tourId, stepIndex })
    },
    [toursById, storage, location, emit],
  )

  // Navigation déléguée : l'étape vit ailleurs, on demande le déplacement.
  useEffect(() => {
    if (!isActive || !step || routeMatches) return

    const destination =
      step.navigateTo ?? (step.route && isLiteralRoute(step.route) ? step.route : null)

    if (!destination) return
    if (!navigate) {
      console.warn('[guide] a step declares a route but no navigate function was provided')
      return
    }
    navigate(destination)
  }, [isActive, step, routeMatches, navigate])

  // Cible introuvable : application de la politique.
  useEffect(() => {
    if (!timedOut || !tour || !step) return

    emit({
      type: 'target:missing',
      tourId: tour.id,
      stepIndex: state.stepIndex,
      target: step.target,
    })

    const policy = step.onMissingTarget ?? onMissingTarget
    if (policy === 'skip') dispatch({ type: 'NEXT', stepCount: tour.steps.length })
    else if (policy === 'error') dispatch({ type: 'STOP' })
    else dispatch({ type: 'PAUSE' })
  }, [timedOut, tour, step, state.stepIndex, onMissingTarget, emit])

  // Reprise automatique quand la cible réapparaît après une pause.
  useEffect(() => {
    if (state.status === 'paused' && element) dispatch({ type: 'RESUME' })
  }, [state.status, element])

  // Étape effectivement affichée.
  useEffect(() => {
    if (state.status !== 'running' || !tour || !step || !element) return
    emit({
      type: 'step:show',
      tourId: tour.id,
      stepIndex: state.stepIndex,
      target: step.target,
    })
    announce(`${state.stepIndex + 1} / ${tour.steps.length}`)
  }, [state.status, state.stepIndex, tour, step, element, emit, announce])

  // Persistance de la progression.
  useEffect(() => {
    if (!storage || !state.tourId) return
    if (state.status === 'running') {
      void storage.write(state.tourId, { status: 'in-progress', stepIndex: state.stepIndex })
    } else if (state.status === 'completed') {
      void storage.write(state.tourId, { status: 'completed', stepIndex: state.stepIndex })
    }
  }, [storage, state.tourId, state.status, state.stepIndex])

  const activeStep = useMemo<ActiveStep | null>(() => {
    if (!tour || !step || !isActive) return null
    return {
      tourId: tour.id,
      step,
      stepIndex: state.stepIndex,
      stepCount: tour.steps.length,
      element,
      rect,
      title: resolveText(step.title, step.titleKey, translate),
      body: resolveText(step.body, step.bodyKey, translate),
      isFirst: state.stepIndex === 0,
      isLast: state.stepIndex === tour.steps.length - 1,
      next,
      previous,
      stop,
    }
  }, [tour, step, isActive, state.stepIndex, element, rect, translate, next, previous, stop])

  const value = useMemo<GuideContextValue>(
    () => ({ state, activeStep, start, next, previous, stop }),
    [state, activeStep, start, next, previous, stop],
  )

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>
}
```

- [ ] **Step 5: Implémenter les deux hooks publics**

`packages/core/src/useTour.ts` :

```ts
'use client'

import { useContext, useMemo } from 'react'
import { GuideContext } from './GuideProvider'
import type { TourStatus } from './types'

export interface UseTourResult {
  start: (options?: { from?: number; resume?: boolean }) => Promise<void>
  next: () => void
  previous: () => void
  stop: () => void
  status: TourStatus
  stepIndex: number
}

export function useTour(tourId: string): UseTourResult {
  const context = useContext(GuideContext)
  if (!context) throw new Error('[guide] useTour must be used inside a GuideProvider')

  const { state, start, next, previous, stop } = context
  const isCurrent = state.tourId === tourId

  return useMemo(
    () => ({
      start: (options) => start(tourId, options),
      next,
      previous,
      stop,
      status: isCurrent ? state.status : 'idle',
      stepIndex: isCurrent ? state.stepIndex : 0,
    }),
    [tourId, start, next, previous, stop, isCurrent, state.status, state.stepIndex],
  )
}
```

`packages/core/src/useGuideStep.ts` :

```ts
'use client'

import { useContext } from 'react'
import { GuideContext, type ActiveStep } from './GuideProvider'

export function useGuideStep(): ActiveStep | null {
  const context = useContext(GuideContext)
  if (!context) throw new Error('[guide] useGuideStep must be used inside a GuideProvider')
  return context.activeStep
}
```

Compléter `packages/core/src/index.ts` :

```ts
export * from './types'
export * from './storage'
export * from './matchRoute'
export * from './tourMachine'
export * from './useTargetElement'
export * from './useElementRect'
export * from './a11y'
export * from './GuideProvider'
export * from './useTour'
export * from './validateTour'
export * from './useGuideStep'
```

- [ ] **Step 6: Lancer les tests et vérifier qu'ils passent**

Run: `pnpm --filter @guide/core test`
Expected: PASS, toute la suite du cœur.

- [ ] **Step 7: Vérifier le typage**

Run: `pnpm --filter @guide/core typecheck`
Expected: aucune erreur.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src packages/core/test
git commit -m "feat(core): fournisseur de contexte, useTour et useGuideStep"
```

---

## Task 8: Paquet MUI et spotlight

**Files:**
- Create: `packages/mui/package.json`
- Create: `packages/mui/tsconfig.json`
- Create: `packages/mui/vitest.config.ts`
- Create: `packages/mui/test/setup.ts`
- Create: `packages/mui/src/Spotlight.tsx`
- Create: `packages/mui/src/index.ts`
- Test: `packages/mui/test/Spotlight.test.tsx`

**Interfaces:**
- Consumes: `Rect` et `usePrefersReducedMotion` depuis `@guide/core`.
- Produces: `Spotlight(props: SpotlightProps)` où
  `SpotlightProps = { rect: Rect | null; padding?: number; radius?: number; interactive?: boolean; zIndex?: number; onDismiss?: () => void }`.
  La tâche 10 l'assemble avec le popover.

- [ ] **Step 1: Créer le paquet**

`packages/mui/package.json` :

```json
{
  "name": "@guide/mui",
  "version": "0.0.0",
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "@guide/core": "workspace:*" },
  "peerDependencies": {
    "@emotion/react": "^11",
    "@emotion/styled": "^11",
    "@mui/material": "^7 || ^9",
    "react": "^19"
  },
  "devDependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "@mui/material": "^7.3.9"
  }
}
```

`packages/mui/tsconfig.json` : identique à celui du cœur, `extends` vers `../../tsconfig.base.json`, `include` sur `src` et `test`.

`packages/mui/vitest.config.ts` et `packages/mui/test/setup.ts` : copies de ceux du cœur. Le fichier de configuration ajoute un alias pour consommer les sources du cœur sans build préalable.

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@guide/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
})
```

- [ ] **Step 2: Écrire le test, qui doit échouer**

`packages/mui/test/Spotlight.test.tsx` :

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Spotlight } from '../src/Spotlight'

const rect = { top: 100, left: 50, width: 200, height: 40 }

describe('Spotlight', () => {
  it('ne rend rien sans rectangle', () => {
    const { container } = render(<Spotlight rect={null} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('découpe un trou aux dimensions de la cible, marge comprise', () => {
    const { container } = render(<Spotlight rect={rect} padding={8} radius={6} />)
    const hole = container.querySelector('mask rect:last-of-type')
    expect(hole).toHaveAttribute('x', '42')
    expect(hole).toHaveAttribute('y', '92')
    expect(hole).toHaveAttribute('width', '216')
    expect(hole).toHaveAttribute('height', '56')
    expect(hole).toHaveAttribute('rx', '6')
  })

  it('appelle onDismiss au clic sur la zone sombre', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<Spotlight rect={rect} onDismiss={onDismiss} />)
    await user.click(screen.getByTestId('guide-spotlight'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('laisse passer les clics quand l étape est interactive', () => {
    render(<Spotlight rect={rect} interactive />)
    expect(screen.getByTestId('guide-spotlight')).toHaveStyle({ pointerEvents: 'none' })
  })

  it('reste hors de l arbre d accessibilité', () => {
    render(<Spotlight rect={rect} />)
    expect(screen.getByTestId('guide-spotlight')).toHaveAttribute('aria-hidden', 'true')
  })
})
```

- [ ] **Step 3: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter @guide/mui test`
Expected: FAIL, module introuvable.

- [ ] **Step 4: Implémenter**

`packages/mui/src/Spotlight.tsx` :

```tsx
'use client'

import { useId } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import { usePrefersReducedMotion, type Rect } from '@guide/core'

export interface SpotlightProps {
  rect: Rect | null
  padding?: number
  radius?: number
  interactive?: boolean
  zIndex?: number
  onDismiss?: () => void
}

export function Spotlight({
  rect,
  padding = 8,
  radius = 8,
  interactive = false,
  zIndex,
  onDismiss,
}: SpotlightProps) {
  const theme = useTheme()
  const maskId = useId()
  const reducedMotion = usePrefersReducedMotion()

  if (!rect) return null

  const overlay = alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.7 : 0.55)
  const transition = reducedMotion ? 'none' : 'all 200ms ease'

  return (
    <Box
      component="svg"
      data-testid="guide-spotlight"
      aria-hidden="true"
      onClick={interactive ? undefined : onDismiss}
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: zIndex ?? theme.zIndex.modal,
        pointerEvents: interactive ? 'none' : 'auto',
      }}
    >
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect
            x={rect.left - padding}
            y={rect.top - padding}
            width={rect.width + padding * 2}
            height={rect.height + padding * 2}
            rx={radius}
            fill="black"
            style={{ transition }}
          />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={overlay} mask={`url(#${maskId})`} />
    </Box>
  )
}
```

`packages/mui/src/index.ts` :

```ts
export * from './Spotlight'
```

- [ ] **Step 5: Lancer le test et vérifier qu'il passe**

Run: `pnpm --filter @guide/mui test`
Expected: PASS, cinq tests.

- [ ] **Step 6: Commit**

```bash
git add packages/mui
git commit -m "feat(mui): overlay spotlight à masque SVG"
```

---

## Task 9: Popover d'étape accessible

**Files:**
- Create: `packages/mui/src/StepPopover.tsx`
- Modify: `packages/mui/src/index.ts`
- Test: `packages/mui/test/StepPopover.test.tsx`

**Interfaces:**
- Consumes: `useFocusTrap` depuis `@guide/core`.
- Produces: `StepPopover(props: StepPopoverProps)` où
  `StepPopoverProps = { anchorEl: HTMLElement | null; open: boolean; title: string; body: string; stepIndex: number; stepCount: number; isFirst: boolean; isLast: boolean; placement?: Placement; zIndex?: number; describeElement?: HTMLElement | null; labels?: Partial<StepPopoverLabels>; onNext: () => void; onPrevious: () => void; onStop: () => void }`
  et `StepPopoverLabels = { next: string; previous: string; finish: string; close: string }`.
  La tâche 10 le monte.

Les libellés par défaut sont en anglais et surchargeables, conformément à la règle qui interdit d'imposer une langue. Le consommateur français passe les siens.

- [ ] **Step 1: Écrire le test, qui doit échouer**

`packages/mui/test/StepPopover.test.tsx` :

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepPopover } from '../src/StepPopover'

function setup(overrides: Partial<React.ComponentProps<typeof StepPopover>> = {}) {
  const anchor = document.createElement('button')
  anchor.textContent = 'ancre'
  document.body.appendChild(anchor)

  const props = {
    anchorEl: anchor,
    open: true,
    title: 'Titre',
    body: 'Corps',
    stepIndex: 1,
    stepCount: 3,
    isFirst: false,
    isLast: false,
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onStop: vi.fn(),
    ...overrides,
  }
  render(<StepPopover {...props} />)
  return props
}

describe('StepPopover', () => {
  it('affiche le titre, le corps et la progression', () => {
    setup()
    expect(screen.getByText('Titre')).toBeInTheDocument()
    expect(screen.getByText('Corps')).toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('est une boîte de dialogue nommée par son titre', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Titre')
  })

  it('appelle onNext au clic sur suivant', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(props.onNext).toHaveBeenCalledOnce()
  })

  it('remplace suivant par terminer à la dernière étape', () => {
    setup({ isLast: true })
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument()
  })

  it('masque le bouton précédent à la première étape', () => {
    setup({ isFirst: true, stepIndex: 0 })
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('ferme avec la touche Échap', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.keyboard('{Escape}')
    expect(props.onStop).toHaveBeenCalledOnce()
  })

  it('navigue avec les flèches', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.keyboard('{ArrowRight}')
    expect(props.onNext).toHaveBeenCalledOnce()
    await user.keyboard('{ArrowLeft}')
    expect(props.onPrevious).toHaveBeenCalledOnce()
  })

  it('accepte des libellés personnalisés', () => {
    setup({ labels: { next: 'Suivant', close: 'Fermer' } })
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeInTheDocument()
  })

  it('ne rend rien quand il est fermé', () => {
    setup({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('relie l élément mis en avant à la description du popover', () => {
    const highlighted = document.createElement('button')
    highlighted.textContent = 'cible mise en avant'
    document.body.appendChild(highlighted)

    setup({ describeElement: highlighted })

    const describedBy = highlighted.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)).toHaveTextContent('Corps')
  })

  it('retire la description quand le popover disparaît', () => {
    const highlighted = document.createElement('button')
    document.body.appendChild(highlighted)

    const anchor = document.createElement('button')
    document.body.appendChild(anchor)

    const view = render(
      <StepPopover
        anchorEl={anchor}
        open
        title="Titre"
        body="Corps"
        stepIndex={0}
        stepCount={1}
        isFirst
        isLast
        describeElement={highlighted}
        onNext={() => {}}
        onPrevious={() => {}}
        onStop={() => {}}
      />,
    )
    expect(highlighted).toHaveAttribute('aria-describedby')
    view.unmount()
    expect(highlighted).not.toHaveAttribute('aria-describedby')
  })
})
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter @guide/mui test StepPopover`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Implémenter**

`packages/mui/src/StepPopover.tsx` :

```tsx
'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Popper from '@mui/material/Popper'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useFocusTrap, type Placement } from '@guide/core'

export interface StepPopoverLabels {
  next: string
  previous: string
  finish: string
  close: string
}

const DEFAULT_LABELS: StepPopoverLabels = {
  next: 'Next',
  previous: 'Back',
  finish: 'Finish',
  close: 'Close',
}

export interface StepPopoverProps {
  anchorEl: HTMLElement | null
  open: boolean
  title: string
  body: string
  stepIndex: number
  stepCount: number
  isFirst: boolean
  isLast: boolean
  placement?: Placement
  zIndex?: number
  /** Élément mis en avant, qui reçoit une description accessible reliée au corps. */
  describeElement?: HTMLElement | null
  labels?: Partial<StepPopoverLabels>
  onNext: () => void
  onPrevious: () => void
  onStop: () => void
}

export function StepPopover({
  anchorEl,
  open,
  title,
  body,
  stepIndex,
  stepCount,
  isFirst,
  isLast,
  placement = 'bottom',
  zIndex,
  describeElement,
  labels,
  onNext,
  onPrevious,
  onStop,
}: StepPopoverProps) {
  const theme = useTheme()
  const titleId = useId()
  const bodyId = useId()
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const text = { ...DEFAULT_LABELS, ...labels }

  useFocusTrap(container, open)

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onStop()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onNext()
      } else if (event.key === 'ArrowLeft' && !isFirst) {
        event.preventDefault()
        onPrevious()
      }
    },
    [onStop, onNext, onPrevious, isFirst],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onKeyDown])

  // L'élément mis en avant est décrit par le corps du popover.
  useEffect(() => {
    if (!open || !describeElement) return
    describeElement.setAttribute('aria-describedby', bodyId)
    return () => describeElement.removeAttribute('aria-describedby')
  }, [open, describeElement, bodyId])

  if (!open) return null

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement={placement}
      sx={{ zIndex: (zIndex ?? theme.zIndex.modal) + 1 }}
      modifiers={[{ name: 'offset', options: { offset: [0, 12] } }]}
    >
      <Paper
        ref={setContainer}
        elevation={8}
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        sx={{ maxWidth: 340, p: 2, borderRadius: 2 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Typography id={titleId} variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
            {title}
          </Typography>
          <IconButton size="small" aria-label={text.close} onClick={onStop}>
            <Box component="span" aria-hidden="true" sx={{ lineHeight: 1 }}>
              ×
            </Box>
          </IconButton>
        </Box>

        <Typography id={bodyId} variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {body}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
            {`${stepIndex + 1} / ${stepCount}`}
          </Typography>
          {!isFirst && (
            <Button size="small" onClick={onPrevious}>
              {text.previous}
            </Button>
          )}
          <Button size="small" variant="contained" onClick={onNext}>
            {isLast ? text.finish : text.next}
          </Button>
        </Box>
      </Paper>
    </Popper>
  )
}
```

Ajouter à `packages/mui/src/index.ts` :

```ts
export * from './StepPopover'
```

Le type `Placement` est déjà exporté par le cœur depuis la tâche 1, il n'y a rien à ajouter.

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `pnpm --filter @guide/mui test`
Expected: PASS, seize tests.

- [ ] **Step 5: Commit**

```bash
git add packages/mui/src/StepPopover.tsx packages/mui/src/index.ts packages/mui/test/StepPopover.test.tsx
git commit -m "feat(mui): popover d'étape accessible au clavier"
```

---

## Task 10: Assemblage du tour

**Files:**
- Create: `packages/mui/src/GuideTour.tsx`
- Modify: `packages/mui/src/index.ts`
- Test: `packages/mui/test/GuideTour.test.tsx`

**Interfaces:**
- Consumes: `useGuideStep`, `GuideProvider` (tâche 7) ; `Spotlight` (tâche 8) ; `StepPopover` (tâche 9).
- Produces: `GuideTour(props?: { zIndex?: number; padding?: number; radius?: number; labels?: Partial<StepPopoverLabels> })`. C'est le seul composant que le consommateur monte. Il ne rend rien tant qu'aucun tour ne tourne, et rien avant le montage client.

- [ ] **Step 1: Écrire le test, qui doit échouer**

`packages/mui/test/GuideTour.test.tsx` :

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuideProvider, useTour, type Tour } from '@guide/core'
import { GuideTour } from '../src/GuideTour'

const tour: Tour = {
  id: 'demo',
  steps: [
    { target: 'one', title: 'Première', body: 'Corps un' },
    { target: 'two', title: 'Deuxième', body: 'Corps deux', interactive: true },
  ],
}

function Starter() {
  const { start } = useTour('demo')
  return <button onClick={() => void start()}>démarrer</button>
}

function Harness() {
  return (
    <GuideProvider tours={[tour]}>
      <button data-guide="one">un</button>
      <button data-guide="two">deux</button>
      <Starter />
      <GuideTour />
    </GuideProvider>
  )
}

describe('GuideTour', () => {
  it('ne rend rien tant qu aucun tour ne tourne', () => {
    render(<Harness />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('guide-spotlight')).not.toBeInTheDocument()
  })

  it('affiche le spotlight et le popover au démarrage', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('démarrer'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('guide-spotlight')).toBeInTheDocument()
    expect(screen.getByText('Première')).toBeInTheDocument()
  })

  it('avance jusqu à l étape interactive et laisse passer les clics', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('démarrer'))
    await screen.findByText('Première')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Deuxième')
    expect(screen.getByTestId('guide-spotlight')).toHaveStyle({ pointerEvents: 'none' })
  })

  it('ferme tout quand le tour est arrêté', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('démarrer'))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter @guide/mui test GuideTour`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Implémenter**

`packages/mui/src/GuideTour.tsx` :

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useGuideStep } from '@guide/core'
import { Spotlight } from './Spotlight'
import { StepPopover, type StepPopoverLabels } from './StepPopover'

export interface GuideTourProps {
  zIndex?: number
  padding?: number
  radius?: number
  labels?: Partial<StepPopoverLabels>
}

export function GuideTour({ zIndex, padding, radius, labels }: GuideTourProps = {}) {
  const active = useGuideStep()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted || !active || !active.element) return null

  return (
    <>
      <Spotlight
        rect={active.rect}
        padding={padding}
        radius={radius}
        interactive={active.step.interactive}
        zIndex={zIndex}
        onDismiss={active.stop}
      />
      <StepPopover
        anchorEl={active.element}
        open
        title={active.title}
        body={active.body}
        stepIndex={active.stepIndex}
        stepCount={active.stepCount}
        isFirst={active.isFirst}
        isLast={active.isLast}
        placement={active.step.placement}
        zIndex={zIndex}
        describeElement={active.element}
        labels={labels}
        onNext={active.next}
        onPrevious={active.previous}
        onStop={active.stop}
      />
    </>
  )
}
```

Ajouter à `packages/mui/src/index.ts` :

```ts
export * from './GuideTour'
```

- [ ] **Step 4: Lancer toute la suite et vérifier qu'elle passe**

Run: `pnpm test`
Expected: PASS, cœur et couche MUI.

- [ ] **Step 5: Commit**

```bash
git add packages/mui/src/GuideTour.tsx packages/mui/src/index.ts packages/mui/test/GuideTour.test.tsx
git commit -m "feat(mui): assemblage du tour, spotlight et popover"
```

---

## Task 11: Application de démonstration multi-pages

**Files:**
- Create: `apps/demo/package.json`
- Create: `apps/demo/index.html`
- Create: `apps/demo/vite.config.ts`
- Create: `apps/demo/tsconfig.json`
- Create: `apps/demo/src/main.tsx`
- Create: `apps/demo/src/App.tsx`
- Create: `apps/demo/src/router.tsx`
- Create: `apps/demo/src/tours.ts`
- Create: `apps/demo/src/pages/Home.tsx`
- Create: `apps/demo/src/pages/Projects.tsx`
- Create: `apps/demo/src/pages/ProjectDetail.tsx`

**Interfaces:**
- Consumes: `GuideProvider`, `useTour`, `createBrowserStorage` depuis `@guide/core` ; `GuideTour` depuis `@guide/mui`.
- Produces: une application servie par `pnpm --filter demo dev` sur le port `5173`, avec les routes `/`, `/projects` et `/projects/:id`. La tâche 12 pilote cette application en Playwright.

Le vocabulaire est générique : projets, membres, réglages. Aucun terme métier Qualiresolve.

- [ ] **Step 1: Créer l'application**

`apps/demo/package.json` :

```json
{
  "name": "demo",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173",
    "build": "vite build",
    "preview": "vite preview --port 5173"
  },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "@guide/core": "workspace:*",
    "@guide/mui": "workspace:*",
    "@mui/material": "^7.3.9",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router": "^7.9.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0"
  }
}
```

`apps/demo/vite.config.ts` :

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ plugins: [react()] })
```

`apps/demo/index.html` : document HTML minimal avec `<div id="root">` et `<script type="module" src="/src/main.tsx">`.

- [ ] **Step 2: Déclarer le tour de démonstration**

`apps/demo/src/tours.ts` :

```ts
import type { Tour } from '@guide/core'

export const productTour: Tour = {
  id: 'product',
  steps: [
    {
      target: 'nav.projects',
      route: '/',
      title: 'Your projects live here',
      body: 'Everything you create is grouped under a project.',
      placement: 'bottom',
    },
    {
      target: 'projects.create',
      route: '/projects',
      navigateTo: '/projects',
      title: 'Create a project',
      body: 'This tour crosses pages. You were moved here automatically.',
      placement: 'bottom',
    },
    {
      target: 'project.share',
      route: '/projects/:id',
      navigateTo: '/projects/42',
      title: 'Share it',
      body: 'Click the button yourself, this step is interactive.',
      interactive: true,
      placement: 'left',
    },
  ],
}
```

- [ ] **Step 3: Monter le fournisseur et le rendu**

`apps/demo/src/App.tsx` :

```tsx
import { useMemo, useState } from 'react'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { useLocation, useNavigate } from 'react-router'
import { GuideProvider, createBrowserStorage } from '@guide/core'
import { GuideTour } from '@guide/mui'
import { productTour } from './tours'
import { Routes } from './router'

export function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('light')
  const theme = useMemo(() => createTheme({ palette: { mode } }), [mode])
  const navigate = useNavigate()
  const location = useLocation()
  const storage = useMemo(() => createBrowserStorage('guide-demo'), [])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GuideProvider
        tours={[productTour]}
        navigate={(path) => navigate(path)}
        location={location.pathname}
        storage={storage}
        onEvent={(event) => console.info('[guide]', event)}
        onMissingTarget="wait"
      >
        <Routes onToggleMode={() => setMode((value) => (value === 'light' ? 'dark' : 'light'))} />
        <GuideTour />
      </GuideProvider>
    </ThemeProvider>
  )
}
```

`apps/demo/src/main.tsx` monte `<BrowserRouter><App /></BrowserRouter>` dans `#root`.

`apps/demo/src/router.tsx` déclare les trois routes et une barre de navigation portant `data-guide="nav.projects"` sur le lien vers les projets, plus un bouton de bascule clair et sombre portant `data-testid="toggle-mode"`.

`apps/demo/src/pages/Projects.tsx` contient un bouton `data-guide="projects.create"`.
`apps/demo/src/pages/ProjectDetail.tsx` contient un bouton `data-guide="project.share"`.
`apps/demo/src/pages/Home.tsx` contient un bouton qui appelle `useTour('product').start({ resume: false })`, portant `data-testid="start-tour"`.

- [ ] **Step 4: Vérifier manuellement**

Run: `pnpm install && pnpm --filter demo dev`
Expected: sur `http://localhost:5173`, le bouton de démarrage lance le tour, la deuxième étape déplace vers la page des projets, la troisième vers le détail, et le spotlight suit la cible au défilement. Vérifier en thème clair et sombre.

- [ ] **Step 5: Commit**

```bash
git add apps/demo
git commit -m "feat(demo): vitrine multi-pages du tour guidé"
```

---

## Task 12: Tests end-to-end et parcours clavier

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/tour.spec.ts`
- Create: `e2e/a11y.spec.ts`
- Modify: `package.json` (script `test:e2e`, devDependency Playwright)

**Interfaces:**
- Consumes: l'application de démonstration de la tâche 11, servie sur le port `5173`.
- Produces: la commande `pnpm test:e2e`. C'est le critère de succès de la version 1 énoncé par la spécification : un tour multi-pages réel fonctionne de bout en bout.

- [ ] **Step 1: Configurer Playwright**

`playwright.config.ts` :

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter demo dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

Ajouter `"@playwright/test": "^1.56.0"` aux devDependencies racine et le script `"test:e2e": "playwright test"`.

- [ ] **Step 2: Écrire le scénario de bout en bout, qui doit échouer**

`e2e/tour.spec.ts` :

```ts
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.goto('/')
})

test('le tour traverse trois pages et se termine', async ({ page }) => {
  await page.getByTestId('start-tour').click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Your projects live here')
  await expect(page.getByTestId('guide-spotlight')).toBeVisible()

  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL('/projects')
  await expect(dialog).toContainText('Create a project')

  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL('/projects/42')
  await expect(dialog).toContainText('Share it')

  await dialog.getByRole('button', { name: 'Finish' }).click()
  await expect(dialog).toBeHidden()
})

test('le tour reprend là où il a été interrompu', async ({ page }) => {
  await page.getByTestId('start-tour').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL('/projects')

  await page.reload()
  await page.goto('/')
  await page.getByTestId('start-tour').click()
  await expect(page.getByRole('dialog')).toContainText('Create a project')
})

test('le spotlight reste sur la cible après défilement', async ({ page }) => {
  await page.getByTestId('start-tour').click()
  const hole = page.locator('mask rect').last()
  const before = await hole.getAttribute('y')
  await page.mouse.wheel(0, 200)
  await expect.poll(() => hole.getAttribute('y')).not.toBe(before)
})

test('l étape interactive laisse cliquer la page', async ({ page }) => {
  await page.getByTestId('start-tour').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Next' }).click()
  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(dialog).toContainText('Share it')
  await page.locator('[data-guide="project.share"]').click()
})
```

`e2e/a11y.spec.ts` :

```ts
import { expect, test } from '@playwright/test'

test('le parcours clavier complet fonctionne', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('start-tour').click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Le focus entre dans la boîte de dialogue.
  await expect(dialog.locator(':focus')).toHaveCount(1)

  // Les flèches font avancer et reculer.
  await page.keyboard.press('ArrowRight')
  await expect(dialog).toContainText('Create a project')
  await page.keyboard.press('ArrowLeft')
  await expect(dialog).toContainText('Your projects live here')

  // Échap ferme le tour.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('le tour est annoncé dans une région dynamique', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('start-tour').click()
  await expect(page.locator('[data-guide-announcer]')).toHaveAttribute('aria-live', 'polite')
})

test('les deux thèmes rendent le tour lisible', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('start-tour').click()
  await expect(page.getByRole('dialog')).toHaveScreenshot('tour-light.png')

  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await page.getByTestId('toggle-mode').click()
  await page.getByTestId('start-tour').click()
  await expect(page.getByRole('dialog')).toHaveScreenshot('tour-dark.png')
})
```

- [ ] **Step 3: Lancer et vérifier l'échec**

Run: `pnpm exec playwright install --with-deps chromium && pnpm test:e2e`
Expected: FAIL au premier passage, les captures de référence n'existent pas encore et les sélecteurs peuvent différer.

- [ ] **Step 4: Corriger la démo jusqu'au vert, puis figer les captures**

Ajuster les attributs `data-guide` et `data-testid` de la tâche 11 jusqu'à ce que les scénarios passent.

Run: `pnpm test:e2e --update-snapshots`
Puis: `pnpm test:e2e`
Expected: PASS, sept scénarios.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e package.json apps/demo
git commit -m "test: parcours end-to-end multi-pages et accessibilité clavier"
```

---

## Task 13: Empaquetage, documentation et publication

**Files:**
- Create: `packages/core/tsup.config.ts`
- Create: `packages/mui/tsup.config.ts`
- Modify: `packages/core/package.json`
- Modify: `packages/mui/package.json`
- Create: `README.md`
- Create: `.changeset/config.json`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: tout le code produit par les tâches précédentes.
- Produces: `pnpm build` génère `dist/index.mjs`, `dist/index.cjs` et `dist/index.d.ts` dans chaque paquet. `pnpm publish --dry-run` réussit sur les deux.

- [ ] **Step 1: Configurer la construction**

`packages/core/tsup.config.ts` :

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['react', 'react-dom'],
  banner: { js: '"use client";' },
  outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
})
```

`packages/mui/tsup.config.ts` : identique, avec
`external: ['react', 'react-dom', '@guide/core', '@mui/material', '@emotion/react', '@emotion/styled']`.

- [ ] **Step 2: Compléter les manifestes**

Ajouter dans les deux `package.json` :

```json
{
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md", "LICENSE"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "publishConfig": { "access": "public" },
  "repository": { "type": "git", "url": "git+https://github.com/loghosp/guide.git" },
  "keywords": ["react", "onboarding", "product-tour", "walkthrough", "mui", "accessibility"]
}
```

Le champ `keywords` du paquet MUI ajoute `material-ui`.

- [ ] **Step 3: Construire et vérifier la sortie**

Run: `pnpm build`
Expected: PASS. Vérifier ensuite :

```bash
test -f packages/core/dist/index.mjs
test -f packages/core/dist/index.cjs
test -f packages/core/dist/index.d.ts
head -1 packages/mui/dist/index.mjs   # doit afficher "use client";
```

- [ ] **Step 4: Écrire le README**

`README.md` couvre, dans cet ordre : ce que fait la bibliothèque en trois phrases, une capture animée de la démo, l'installation des deux paquets, l'exemple minimal complet (déclaration d'un tour, montage du fournisseur, attribut sur une cible, montage de `GuideTour`), le tableau des propriétés de `GuideProvider`, la section sur les tours multi-pages, la section sur la persistance avec l'exemple d'une implémentation adossée à une interface serveur, la section sur les traductions, le tableau des événements, la section accessibilité, la matrice de compatibilité React et MUI, et la licence.

Une section « Prior art » cite driver.js, react-joyride et reactour, avec leurs licences MIT. Elle mentionne que le spotlight s'inspire de l'approche de driver.js.

- [ ] **Step 5: Configurer l'intégration continue**

`.github/workflows/ci.yml` déclenché sur `push` et `pull_request` :

```yaml
name: ci
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report
```

- [ ] **Step 6: Installer Changesets et préparer la première version**

```bash
pnpm add -Dw @changesets/cli
pnpm exec changeset init
pnpm exec changeset      # minor sur @guide/core et @guide/mui
```

Passer les deux paquets en `0.1.0` via `pnpm exec changeset version`.

- [ ] **Step 7: Vérifier la publication à blanc**

Run: `pnpm -r --filter "./packages/*" publish --dry-run --no-git-checks`
Expected: PASS pour les deux paquets. Si le scope `@guide` est refusé, appliquer le repli `@guidekit` sur les deux manifestes, sur les imports, et dans le README, puis relancer.

- [ ] **Step 8: Commit**

```bash
git add packages README.md .changeset .github
git commit -m "chore: empaquetage double format, documentation et intégration continue"
```

---

## Suite

La checklist de premiers pas fait l'objet d'un plan distinct, écrit une fois cette version stabilisée. Elle réutilise `GuideStorage` sans le modifier et ajoute un composant capable de déclencher un tour depuis un de ses éléments.

L'intégration dans le front Qualiresolve fait également l'objet d'un plan distinct, dans le dépôt du front : implémentation de `GuideStorage` adossée au backend, filtrage des tours par rôle et par section, clés i18next, et déclaration des tours métier.
