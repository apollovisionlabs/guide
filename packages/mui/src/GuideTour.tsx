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
        modal={!active.step.interactive}
        labels={labels}
        onNext={active.next}
        onPrevious={active.previous}
        onStop={active.stop}
      />
    </>
  )
}
