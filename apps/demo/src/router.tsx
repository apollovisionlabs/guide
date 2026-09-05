import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material'
import { Link, Route, Routes } from 'react-router'
import { Home } from './pages/Home'
import { Projects } from './pages/Projects'
import { ProjectDetail } from './pages/ProjectDetail'

export interface AppRoutesProps {
  onToggleMode: () => void
}

export function AppRoutes({ onToggleMode }: AppRoutesProps) {
  return (
    <>
      <AppBar position="static">
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Guide demo
          </Typography>
          <Button color="inherit" component={Link} to="/">
            Home
          </Button>
          <Button color="inherit" component={Link} to="/projects" data-guide="nav.projects">
            Projects
          </Button>
          <Button color="inherit" data-testid="toggle-mode" onClick={onToggleMode}>
            Toggle mode
          </Button>
          <Button color="inherit" component={Link} to="/unstyled">
            Unstyled demo
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
          </Routes>
        </Box>
      </Container>
    </>
  )
}
