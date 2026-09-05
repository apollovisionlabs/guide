import { useParams } from 'react-router'

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>Project {id}</h1>
        <button type="button" data-guide="project.share" style={{ padding: '8px 16px' }}>
          Share
        </button>
      </div>
      <p>
        This is the detail page for project {id}. It shows the members, settings, and activity
        for a single project.
      </p>
      <h2>Members</h2>
      <p>
        Members can be invited to a project and given access to its settings. Sharing a project
        with a new member sends them an invitation.
      </p>
      <h2>Settings</h2>
      <p>
        Every project has its own settings: a name, a description, and a list of members. None of
        that is wired up to a backend in this demo, since the point here is the tour, not the
        product.
      </p>
      <h2>Activity</h2>
      <p style={{ paddingBottom: 32 }}>
        Recent activity for this project would appear here. In a real product this list would
        grow over time as members work on the project.
      </p>
    </div>
  )
}
