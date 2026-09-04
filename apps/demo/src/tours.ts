import type { Tour } from '@apollovisionlabs/guide-core'

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
      advanceOn: 'click',
      placement: 'left',
    },
  ],
}
