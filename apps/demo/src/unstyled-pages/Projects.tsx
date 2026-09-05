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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>Projects</h1>
        <button type="button" data-guide="projects.create" style={{ padding: '8px 16px' }}>
          Create project
        </button>
      </div>
      <p>
        Every piece of work in this demo lives under a project. Pick one to see its detail page.
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {projects.map((project) => (
          <li key={project.id} style={{ border: '1px solid #ccc', borderRadius: 4 }}>
            <Link
              to={`/unstyled/projects/${project.id}`}
              style={{ display: 'block', padding: 16, color: 'inherit', textDecoration: 'none' }}
            >
              <div>{project.name}</div>
              <div>{project.members} members</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
