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

/**
 * Échappatoire clavier pendant l'attente d'une cible : le popover n'est pas monté, donc son
 * propre gestionnaire d'Échap non plus, et le tour serait à la fois invisible et sans issue.
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

  // Attente silencieuse : rien ne s'affiche tant que la cible n'est pas résolue, mais le tour
  // reste quittable au clavier.
  if (!active.element) return <EscapeToStop onStop={active.stop} />

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
        modal={!active.step.interactive}
        labels={labels}
        onNext={active.next}
        onPrevious={active.previous}
        onStop={active.stop}
      />
    </>
  )
}
