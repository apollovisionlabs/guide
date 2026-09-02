import { Button, Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material'
import { Link } from 'react-router'

const projects = [
  { id: 1, name: 'Website redesign', members: 4 },
  { id: 2, name: 'Mobile app', members: 6 },
  { id: 3, name: 'Internal tooling', members: 3 },
  { id: 4, name: 'Marketing site', members: 2 },
  { id: 42, name: 'Onboarding flow', members: 5 },
]

export function Projects() {
  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h4" component="h1">
          Projects
        </Typography>
        <Button variant="contained" data-guide="projects.create">
          Create project
        </Button>
      </Stack>
      <Typography>
        Every piece of work in this demo lives under a project. Pick one to see its detail page.
      </Typography>
      <Stack spacing={2} sx={{ pb: 8 }}>
        {projects.map((project) => (
          <Card key={project.id} variant="outlined">
            <CardActionArea component={Link} to={`/projects/${project.id}`}>
              <CardContent>
                <Typography variant="h6" component="h2">
                  {project.name}
                </Typography>
                <Typography color="text.secondary">{project.members} members</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}
