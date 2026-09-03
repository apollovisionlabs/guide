import { useMemo, useState } from 'react'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { useLocation, useNavigate } from 'react-router'
import { ChecklistProvider, GuideProvider, createBrowserStorage } from '@apollovisionlabs/guide-core'
import { ChecklistLauncher, GuideTour } from '@apollovisionlabs/guide-mui'
import { productTour } from './tours'
import { onboardingChecklist } from './checklists'
import { AppRoutes } from './router'

export function App() {
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
        <ChecklistProvider
          checklists={[onboardingChecklist]}
          navigate={(path) => navigate(path)}
          storage={storage}
          onEvent={(event) => console.info('[guide]', event)}
        >
          <AppRoutes onToggleMode={() => setMode((value) => (value === 'light' ? 'dark' : 'light'))} />
          <GuideTour />
          <ChecklistLauncher checklistId="onboarding" title="Get started" />
        </ChecklistProvider>
      </GuideProvider>
    </ThemeProvider>
  )
}
