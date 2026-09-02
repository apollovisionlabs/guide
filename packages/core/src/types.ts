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
