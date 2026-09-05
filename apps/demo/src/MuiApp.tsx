import { useMemo, useState } from 'react'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { useLocation, useNavigate } from 'react-router'
import {
  ChecklistProvider,
  GuideProvider,
  HotspotProvider,
  createBrowserStorage,
} from '@apollovisionlabs/guide-core'
import { ChecklistLauncher, GuideTour, Hotspots } from '@apollovisionlabs/guide-mui'
import { productTour } from './tours'
import { onboardingChecklist } from './checklists'
import { hotspots } from './hotspots'
import { AppRoutes } from './router'

export function MuiApp() {
  const [mode, setMode] = useState<'light' | 'dark'>('light')
  const theme = useMemo(() => createTheme({ palette: { mode } }), [mode])
  const navigate = useNavigate()
  const location = useLocation()
  const storage = useMemo(() => createBrowserStorage('guide-demo'), [])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GuideProvider
        tours={[productTour]}
        navigate={(path) => navigate(path)}
        location={location.pathname}
        storage={storage}
        onEvent={(event) => console.info('[guide]', event)}
        onMissingTarget="wait"
      >
        <HotspotProvider
          hotspots={hotspots}
          storage={storage}
          onEvent={(event) => console.info('[guide]', event)}
        >
          <ChecklistProvider
            checklists={[onboardingChecklist]}
            navigate={(path) => navigate(path)}
            storage={storage}
            onEvent={(event) => console.info('[guide]', event)}
          >
            <AppRoutes onToggleMode={() => setMode((value) => (value === 'light' ? 'dark' : 'light'))} />
            <GuideTour />
            <Hotspots />
            <ChecklistLauncher checklistId="onboarding" title="Get started" />
          </ChecklistProvider>
        </HotspotProvider>
      </GuideProvider>
    </ThemeProvider>
  )
}
