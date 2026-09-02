import { Button, Stack, Typography } from '@mui/material'
import { useTour } from '@apollovisionlabs/guide-core'

export function Home() {
  const tour = useTour('product')

  return (
    // Comfortable margin below the fold: the end-to-end scroll scenario depends on a page
    // taller than the viewport.
    <Stack spacing={3} sx={{ minHeight: 1400 }}>
      <Typography variant="h4" component="h1">
        Welcome
      </Typography>
      <Typography>
        This is a small demo application built to show off the guided tour component. It has a
        home page, a list of projects, and a detail page for each project. Use the button below
        to start the tour, or explore the pages yourself.
      </Typography>
      <Button
        variant="contained"
        data-testid="start-tour"
        onClick={() => tour.start()}
      >
        Start the tour
      </Button>
      <Typography variant="h5" component="h2" sx={{ pt: 4 }}>
        Why a guided tour
      </Typography>
      <Typography>
        Onboarding a new user to an unfamiliar interface is hard. A guided tour walks a person
        through the parts of the product that matter, one step at a time, without forcing them to
        read a manual first.
      </Typography>
      <Typography>
        The tour in this demo crosses three pages: it starts here, moves to the projects list,
        and finishes on a project's detail page. Each step highlights a real element on the page
        so you can see the spotlight follow it as you scroll.
      </Typography>
      <Typography>
        Try toggling between light and dark mode using the button in the app bar. The tour and
        every page in this demo are designed to look good in both.
      </Typography>
      <Typography>
        Scroll down a little further to see how the page behaves when there is more content than
        fits in the viewport. The tour should still find its target and position itself
        correctly.
      </Typography>
      <Typography sx={{ pb: 8 }}>
        That is the whole demo. Head to the projects page whenever you are ready, or press the
        button above to let the tour guide you there.
      </Typography>
    </Stack>
  )
}
