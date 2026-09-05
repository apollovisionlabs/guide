import { useTour } from '@apollovisionlabs/guide-core'

export function Home() {
  const tour = useTour('product')

  return (
    // Comfortable margin below the fold: the end-to-end scroll scenario depends on a page
    // taller than the viewport.
    <div style={{ minHeight: 1400, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1>Welcome</h1>
      <p>
        This is the same demo application, rendered with no UI toolkit. It has a home page, a
        list of projects, and a detail page for each project. Use the button below to start the
        tour, or explore the pages yourself.
      </p>
      <button type="button" data-testid="start-tour" onClick={() => tour.start()}>
        Start the tour
      </button>
      <h2>Why a guided tour</h2>
      <p>
        Onboarding a new user to an unfamiliar interface is hard. A guided tour walks a person
        through the parts of the product that matter, one step at a time, without forcing them to
        read a manual first.
      </p>
      <p>
        The tour on this route is the exact same declaration as the one on the styled route: it
        starts here, moves to the projects list, and finishes on a project's detail page. Only
        the rendering layer changed.
      </p>
      <p>
        Scroll down a little further to see how the page behaves when there is more content than
        fits in the viewport. The tour should still find its target and position itself
        correctly.
      </p>
      <p style={{ paddingBottom: 32 }}>
        That is the whole demo. Head to the projects page whenever you are ready, or press the
        button above to let the tour guide you there.
      </p>
    </div>
  )
}
