import type { Hotspot } from '@apollovisionlabs/guide-core'

export const hotspots: Hotspot[] = [
  {
    id: 'create',
    target: 'projects.create',
    title: 'Start a project',
    body: 'Everything else in here hangs off a project.',
  },
  {
    id: 'share',
    target: 'project.share',
    title: 'Share a project',
    body: 'Send a link to anyone on your team.',
    tourId: 'product',
  },
]
