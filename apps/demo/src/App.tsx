import { useMemo, useState } from 'react'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { useLocation, useNavigate } from 'react-router'
import { GuideProvider, createBrowserStorage } from '@apollovisionlabs/guide-core'
import { GuideTour } from '@apollovisionlabs/guide-mui'
import { productTour } from './tours'
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
        <AppRoutes onToggleMode={() => setMode((value) => (value === 'light' ? 'dark' : 'light'))} />
        <GuideTour />
      </GuideProvider>
    </ThemeProvider>
  )
}
