import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { GuideProvider } from '../src/GuideProvider'
import { useTour } from '../src/useTour'
import { useGuideStep } from '../src/useGuideStep'
import { createMemoryStorage } from '../src/storage'
import type { GuideEvent, Tour } from '../src/types'

const tour: Tour = {
  id: 'demo',
  steps: [
    { target: 'one', title: 'Première' },
    { target: 'two', title: 'Deuxième' },
  ],
}

function StepReadout() {
  const active = useGuideStep()
  if (!active) return <p>aucune étape</p>
  return (
    <div>
      <p>{active.title}</p>
      <p>{`${active.stepIndex + 1}/${active.stepCount}`}</p>
      <button onClick={active.next}>suivant</button>
      <button onClick={active.stop}>arrêter</button>
    </div>
  )
}

function Starter() {
  const { start, status } = useTour('demo')
  return (
    <>
      <button onClick={() => void start()}>démarrer</button>
      <span>{status}</span>
    </>
  )
}

function Harness(props: Partial<ComponentProps<typeof GuideProvider>> = {}) {
  return (
    <GuideProvider tours={[tour]} {...props}>
      <button data-guide="one">un</button>
      <button data-guide="two">deux</button>
      <Starter />
      <StepReadout />
    </GuideProvider>
  )
}

describe('GuideProvider', () => {
  it('n affiche aucune étape avant le démarrage', () => {
    render(<Harness />)
    expect(screen.getByText('aucune étape')).toBeInTheDocument()
  })

  it('démarre le tour et expose la première étape', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('démarrer'))
    expect(await screen.findByText('Première')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('avance puis termine le tour', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('démarrer'))
    await screen.findByText('Première')
    await user.click(screen.getByText('suivant'))
    expect(await screen.findByText('Deuxième')).toBeInTheDocument()
    await user.click(screen.getByText('suivant'))
    await waitFor(() => expect(screen.getByText('completed')).toBeInTheDocument())
  })

  it('résout l élément cible et son rectangle', async () => {
    const user = userEvent.setup()
    function RectReadout() {
      const active = useGuideStep()
      return <span data-testid="resolved">{active?.element?.textContent ?? 'rien'}</span>
    }
    render(
      <GuideProvider tours={[tour]}>
        <button data-guide="one">un</button>
        <Starter />
        <RectReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('démarrer'))
    await waitFor(() => expect(screen.getByTestId('resolved')).toHaveTextContent('un'))
  })

  it('émet les événements du cycle de vie', async () => {
    const user = userEvent.setup()
    const events: GuideEvent[] = []
    render(<Harness onEvent={(event) => events.push(event)} />)
    await user.click(screen.getByText('démarrer'))
    await screen.findByText('Première')
    await user.click(screen.getByText('suivant'))
    await screen.findByText('Deuxième')
    await user.click(screen.getByText('suivant'))

    await waitFor(() =>
      expect(events.map((event) => event.type)).toEqual(
        expect.arrayContaining(['tour:start', 'step:show', 'tour:complete']),
      ),
    )
  })

  it('reprend à l étape enregistrée', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage({ demo: { status: 'in-progress', stepIndex: 1 } })
    render(<Harness storage={storage} />)
    await user.click(screen.getByText('démarrer'))
    expect(await screen.findByText('Deuxième')).toBeInTheDocument()
  })

  it('écrit la progression dans la persistance', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    render(<Harness storage={storage} />)
    await user.click(screen.getByText('démarrer'))
    await screen.findByText('Première')
    await waitFor(async () =>
      expect(await storage.read('demo')).toEqual({ status: 'in-progress', stepIndex: 0 }),
    )
  })

  it('traduit les clés de texte', async () => {
    const user = userEvent.setup()
    const translated: Tour = { id: 'demo', steps: [{ target: 'one', titleKey: 'a.title' }] }
    render(
      <GuideProvider tours={[translated]} translate={(key) => `traduit:${key}`}>
        <button data-guide="one">un</button>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('démarrer'))
    expect(await screen.findByText('traduit:a.title')).toBeInTheDocument()
  })

  it('navigue quand l étape vit sur une autre route', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const routed: Tour = { id: 'demo', steps: [{ target: 'one', route: '/other' }] }
    render(
      <GuideProvider tours={[routed]} location="/" navigate={navigate}>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('démarrer'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/other'))
  })

  it('utilise navigateTo quand la route est paramétrée', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const routed: Tour = {
      id: 'demo',
      steps: [{ target: 'one', route: '/item/:id', navigateTo: '/item/42' }],
    }
    render(
      <GuideProvider tours={[routed]} location="/" navigate={navigate}>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('démarrer'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/item/42'))
  })

  it('saute l étape quand la cible manque et que la politique est skip', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const partial: Tour = {
      id: 'demo',
      steps: [
        { target: 'absent', title: 'Première' },
        { target: 'two', title: 'Deuxième' },
      ],
    }
    render(
      <GuideProvider tours={[partial]} onMissingTarget="skip" targetTimeoutMs={500}>
        <button data-guide="two">deux</button>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('démarrer'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(await screen.findByText('Deuxième')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('avertit en développement quand une cible attendue sur la page courante manque', async () => {
    const user = userEvent.setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const partial: Tour = {
      id: 'demo',
      steps: [
        { target: 'one', route: '/', title: 'Première' },
        { target: 'absent', route: '/', title: 'Deuxième' },
      ],
    }
    render(
      <GuideProvider tours={[partial]} location="/">
        <button data-guide="one">un</button>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('démarrer'))
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('absent')),
    )
    warn.mockRestore()
  })

  it('refuse deux tours portant le même identifiant', () => {
    const duplicate: Tour = { id: 'demo', steps: [] }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <GuideProvider tours={[tour, duplicate]}>
          <span />
        </GuideProvider>,
      ),
    ).toThrow(/duplicate tour id/)
    spy.mockRestore()
  })

  it('reprend après expiration quand la cible finit par apparaître (politique wait)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const late: Tour = { id: 'demo', steps: [{ target: 'late', title: 'Première' }] }

    render(
      <GuideProvider tours={[late]} targetTimeoutMs={500}>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )

    await user.click(screen.getByText('démarrer'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(await screen.findByText('paused')).toBeInTheDocument()

    const host = document.createElement('div')
    document.body.appendChild(host)
    host.innerHTML = '<button data-guide="late">tard</button>'

    await waitFor(() => expect(screen.getByText('running')).toBeInTheDocument())
    vi.useRealTimers()
  })

  it('ignore un second démarrage du tour déjà en cours', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('démarrer'))
    await screen.findByText('Première')
    await user.click(screen.getByText('suivant'))
    await screen.findByText('Deuxième')
    await user.click(screen.getByText('démarrer'))
    expect(screen.getByText('Deuxième')).toBeInTheDocument()
  })

  it('ne navigue qu une fois quand la position ne change pas entre les rendus', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const routed: Tour = { id: 'demo', steps: [{ target: 'one', route: '/other' }] }

    function Wrapper({ tick }: { tick: number }) {
      // navigate recree a chaque rendu, comme le ferait une fonction flechee en ligne.
      const inlineNavigate = (path: string) => navigate(path)
      return (
        <GuideProvider tours={[routed]} location="/" navigate={inlineNavigate}>
          <Starter />
          <StepReadout />
          <span>{tick}</span>
        </GuideProvider>
      )
    }

    const { rerender } = render(<Wrapper tick={0} />)
    await user.click(screen.getByText('démarrer'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/other'))

    rerender(<Wrapper tick={1} />)
    rerender(<Wrapper tick={2} />)

    expect(navigate).toHaveBeenCalledTimes(1)
  })
})
