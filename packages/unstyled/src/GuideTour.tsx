'use client'

import { useEffect, useState } from 'react'
import { useGuideStep } from '@apollovisionlabs/guide-core'
import { Spotlight } from './Spotlight'
import { StepPopover, type StepPopoverLabels } from './StepPopover'

export interface GuideTourProps {
  zIndex?: number
  padding?: number
  radius?: number
  labels?: Partial<StepPopoverLabels>
}

/**
 * Keyboard escape hatch while a target is awaited: the popover is not mounted, so neither is its
 * own Escape handler, and the tour would be both invisible and impossible to quit.
 */
function EscapeToStop({ onStop }: { onStop: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onStop()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onStop])

  return null
}

export function GuideTour({ zIndex, padding, radius, labels }: GuideTourProps = {}) {
  const active = useGuideStep()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted || !active) return null

  // Silent wait: nothing is drawn until the target resolves, but the tour stays quittable from
  // the keyboard.
  if (!active.element) return <EscapeToStop onStop={active.stop} />

  return (
    <>
      <Spotlight
        rect={active.rect}
        padding={padding}
        radius={radius}
        interactive={active.interactive}
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
        modal={!active.interactive}
        awaitsAction={active.awaitsAction}
        labels={labels}
        onNext={active.next}
        onPrevious={active.previous}
        onStop={active.stop}
      />
    </>
  )
}
