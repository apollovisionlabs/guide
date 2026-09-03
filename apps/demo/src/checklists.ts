import type { Checklist } from '@apollovisionlabs/guide-core'

export const onboardingChecklist: Checklist = {
  id: 'onboarding',
  items: [
    { id: 'tour', title: 'Take the product tour', body: 'Two minutes, three screens.', tourId: 'product' },
    { id: 'projects', title: 'Open the projects page', body: 'See what a list looks like.', href: '/projects' },
    { id: 'theme', title: 'Try dark mode', body: 'The tour follows your theme.' },
  ],
}
