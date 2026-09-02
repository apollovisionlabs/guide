import { Button, Stack, Typography } from '@mui/material'
import { useParams } from 'react-router'

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h4" component="h1">
          Project {id}
        </Typography>
        <Button variant="contained" data-guide="project.share">
          Share
        </Button>
      </Stack>
      <Typography>
        This is the detail page for project {id}. It shows the members, settings, and activity
        for a single project.
      </Typography>
      <Typography variant="h5" component="h2" sx={{ pt: 2 }}>
        Members
      </Typography>
      <Typography>
        Members can be invited to a project and given access to its settings. Sharing a project
        with a new member sends them an invitation.
      </Typography>
      <Typography variant="h5" component="h2" sx={{ pt: 2 }}>
        Settings
      </Typography>
      <Typography>
        Every project has its own settings: a name, a description, and a list of members. None of
        that is wired up to a backend in this demo, since the point here is the tour, not the
        product.
      </Typography>
      <Typography variant="h5" component="h2" sx={{ pt: 2 }}>
        Activity
      </Typography>
      <Typography sx={{ pb: 8 }}>
        Recent activity for this project would appear here. In a real product this list would
        grow over time as members work on the project.
      </Typography>
    </Stack>
  )
}
