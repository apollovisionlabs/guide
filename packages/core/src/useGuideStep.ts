'use client'

import { useContext } from 'react'
import { GuideContext, type ActiveStep } from './GuideProvider'

export function useGuideStep(): ActiveStep | null {
  const context = useContext(GuideContext)
  if (!context) throw new Error('[guide] useGuideStep must be used inside a GuideProvider')
  return context.activeStep
}
