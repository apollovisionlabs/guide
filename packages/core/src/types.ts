export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export type MissingTargetPolicy = 'skip' | 'wait' | 'error'

export type Placement = 'top' | 'bottom' | 'left' | 'right'

export interface Step {
  /** Logical key carried by the data-guide attribute on the targeted element. */
  target: string
  /** Route pattern on which the step is valid. Accepts :param and *. */
  route?: string
  /** Concrete path to navigate to. Defaults to route when route is literal. */
  navigateTo?: string
  placement?: Placement
  /** Lets the user interact with the page during the step. */
  interactive?: boolean
  title?: string
  titleKey?: string
  body?: string
  bodyKey?: string
  /** Overrides the global policy for this step. */
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
  /**
   * Reads a previously written value. The key is namespaced by the caller,
   * `tour:<id>` or `checklist:<id>`, so one storage serves both.
   */
  read<T>(key: string): Promise<T | null>
  write<T>(key: string, value: T): Promise<void>
}

export type GuideEvent =
  | { type: 'tour:start'; tourId: string; stepIndex: number }
  | { type: 'tour:complete'; tourId: string }
  | { type: 'tour:stop'; tourId: string; stepIndex: number }
  | { type: 'step:show'; tourId: string; stepIndex: number; target: string }
  | { type: 'target:missing'; tourId: string; stepIndex: number; target: string }

export type Translate = (key: string) => string
