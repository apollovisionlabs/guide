import { useMemo } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router'
import {
  ChecklistProvider,
  GuideProvider,
  HotspotProvider,
  createBrowserStorage,
} from '@apollovisionlabs/guide-core'
import { ChecklistLauncher, GuideTour, Hotspots } from '@apollovisionlabs/guide-unstyled'
import '@apollovisionlabs/guide-unstyled/styles.css'
import { productTour } from './tours'
import { onboardingChecklist } from './checklists'
import { hotspots } from './hotspots'
import { Home } from './unstyled-pages/Home'
import { Projects } from './unstyled-pages/Projects'
import { ProjectDetail } from './unstyled-pages/ProjectDetail'

const PREFIX = '/unstyled'

/**
 * Mounted at "/unstyled/*". The tour, checklist and hotspot declarations imported above are the
 * exact same objects the styled route uses, and their `route` and `navigateTo` strings are
 * written relative to that route's own root ("/", "/projects", "/projects/:id"). Stripping and
 * re-adding the "/unstyled" prefix here, rather than in those declarations, is what keeps them
 * shared between the two routes.
 */
export function UnstyledApp() {
  const navigate = useNavigate()
  const location = useLocation()
  const storage = useMemo(() => createBrowserStorage('guide-demo-unstyled'), [])

  const relativePath = location.pathname.slice(PREFIX.length) || '/'
  const goTo = (path: string) => navigate(path === '/' ? PREFIX : `${PREFIX}${path}`)

  return (
    <GuideProvider
      tours={[productTour]}
      navigate={goTo}
      location={relativePath}
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
          navigate={goTo}
          storage={storage}
          onEvent={(event) => console.info('[guide]', event)}
        >
          <nav style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #ccc' }}>
            <span>Guide demo, unstyled</span>
            <div style={{ display: 'flex', gap: 16 }}>
              <Link to={PREFIX}>Home</Link>
              <Link to={`${PREFIX}/projects`} data-guide="nav.projects">
                Projects
              </Link>
              <Link to="/">Styled demo</Link>
            </div>
          </nav>
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
            </Routes>
          </div>
          <GuideTour />
          <Hotspots />
          <ChecklistLauncher checklistId="onboarding" title="Get started" />
        </ChecklistProvider>
      </HotspotProvider>
    </GuideProvider>
  )
}
