import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HotspotProvider } from '../src/HotspotProvider'
import { useHotspots } from '../src/useHotspots'
import { GuideProvider } from '../src/GuideProvider'
import { createMemoryStorage } from '../src/storage'
import type { GuideEvent, Hotspot, Tour } from '../src/types'

const hotspots: Hotspot[] = [
  { id: 'filters', target: 'filters', title: 'Filters', body: 'Narrow the list.' },
  { id: 'share', target: 'share', title: 'Share', body: 'Send a link.', tourId: 'demo' },
]

function Readout() {
  const { hotspots: resolved, open, reset } = useHotspots()
  return (
    <div>
      {resolved.map((entry) => (
        <p key={entry.id}>{`${entry.id}:${entry.title}:${entry.seen}`}</p>
      ))}
      <button onClick={() => open('filters')}>open filters</button>
      <button onClick={() => open('nope')}>open unknown</button>
      <button onClick={reset}>reset</button>
    </div>
  )
}

describe('HotspotProvider', () => {
  it('resolves every hotspot, unseen at first', () => {
    render(
      <HotspotProvider hotspots={hotspots}>
        <Readout />
      </HotspotProvider>,
    )
    expect(screen.getByText('filters:Filters:false')).toBeInTheDocument()
    expect(screen.getByText('share:Share:false')).toBeInTheDocument()
  })

  it('marks a hotspot seen when it is opened, and emits', async () => {
    const user = userEvent.setup()
    const onEvent = vi.fn()
    render(
      <HotspotProvider hotspots={hotspots} onEvent={onEvent}>
        <Readout />
      </HotspotProvider>,
    )
    await user.click(screen.getByText('open filters'))
    expect(await screen.findByText('filters:Filters:true')).toBeInTheDocument()
    expect(onEvent).toHaveBeenCalledWith({ type: 'hotspot:open', hotspotId: 'filters' })
  })

  it('persists the seen state and restores it', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    const { unmount } = render(
      <HotspotProvider hotspots={hotspots} storage={storage}>
        <Readout />
      </HotspotProvider>,
    )
    await user.click(screen.getByText('open filters'))
    await screen.findByText('filters:Filters:true')
    unmount()

    render(
      <HotspotProvider hotspots={hotspots} storage={storage}>
        <Readout />
      </HotspotProvider>,
    )
    expect(await screen.findByText('filters:Filters:true')).toBeInTheDocument()
  })

  it('ignores a stored value of the wrong shape', async () => {
    // `42` is not a string, so isHotspotsProgress must reject this even though it is an
    // array. A guard that only checked Array.isArray (or was skipped entirely, since the
    // merge below is `Array.prototype.concat`/`filter`, both of which run fine over an array
    // of mixed types) would happily merge this in, and 'filters' would read seen:true
    // instead of the default false. A plain string (the shape the brief sketched) does not
    // serve this purpose: `stored.seen.filter` throwing on a string hides the guard's
    // absence behind an unhandled rejection instead of a wrong-but-visible value, and every
    // hotspot starts unseen anyway, so waiting on the DOM alone could not tell "the guard ran
    // and rejected this" apart from "nothing ran yet". Spying on `storage.read` and awaiting
    // its own result (the same device ChecklistProvider's equivalent test uses) forces the
    // assertion to run only after the restore effect has actually settled.
    const storage = createMemoryStorage({ 'hotspots:seen': { seen: ['filters', 42] } })
    const read = vi.spyOn(storage, 'read')
    render(
      <HotspotProvider hotspots={hotspots} storage={storage}>
        <Readout />
      </HotspotProvider>,
    )
    await waitFor(() => expect(read).toHaveBeenCalledWith('hotspots:seen'))
    await act(async () => {
      await Promise.all(read.mock.results.map((result) => result.value))
    })
    expect(screen.getByText('filters:Filters:false')).toBeInTheDocument()
    expect(screen.queryByText('filters:Filters:true')).not.toBeInTheDocument()
  })

  it('warns and changes nothing for an unknown id', async () => {
    const user = userEvent.setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onEvent = vi.fn()
    render(
      <HotspotProvider hotspots={hotspots} onEvent={onEvent}>
        <Readout />
      </HotspotProvider>,
    )
    await user.click(screen.getByText('open unknown'))
    expect(warn).toHaveBeenCalledWith('[guide] unknown hotspot "nope"')
    // 'nope' is not one of the rendered hotspots, so a provider that forgot to return after
    // an unresolved id would still be invisible in the Readout above. Watching onEvent
    // catches it directly: a provider that emits before resolving would call it with
    // { type: 'hotspot:open', hotspotId: 'nope' } here.
    expect(onEvent).not.toHaveBeenCalled()
    expect(screen.getByText('filters:Filters:false')).toBeInTheDocument()
    warn.mockRestore()
  })

  it('throws on duplicate ids, which are a wiring mistake', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <HotspotProvider hotspots={[hotspots[0]!, hotspots[0]!]}>
          <Readout />
        </HotspotProvider>,
      ),
    ).toThrow('[guide] duplicate hotspot id: filters')
    error.mockRestore()
  })

  it('resolves titleKey and bodyKey through translate', () => {
    render(
      <HotspotProvider
        hotspots={[{ id: 'filters', target: 'filters', titleKey: 'a', bodyKey: 'b' }]}
        translate={(key) => (key === 'a' ? 'Filtres' : 'Réduire la liste.')}
      >
        <Readout />
      </HotspotProvider>,
    )
    expect(screen.getByText('filters:Filtres:false')).toBeInTheDocument()
  })

  it('reset clears the seen state', async () => {
    const user = userEvent.setup()
    render(
      <HotspotProvider hotspots={hotspots}>
        <Readout />
      </HotspotProvider>,
    )
    await user.click(screen.getByText('open filters'))
    await screen.findByText('filters:Filters:true')
    await user.click(screen.getByText('reset'))
    expect(await screen.findByText('filters:Filters:false')).toBeInTheDocument()
  })

  it('warns when a hotspot names a tour with no GuideProvider above', async () => {
    const user = userEvent.setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    function StartShare() {
      const { startTour } = useHotspots()
      return <button onClick={() => startTour('share')}>start share</button>
    }
    render(
      <HotspotProvider hotspots={hotspots}>
        <StartShare />
      </HotspotProvider>,
    )
    await user.click(screen.getByText('start share'))
    expect(warn).toHaveBeenCalledWith(
      '[guide] a hotspot needs a GuideProvider to launch a tour',
    )
    warn.mockRestore()
  })

  it('starts the tour a hotspot names', async () => {
    const user = userEvent.setup()
    const onEvent = vi.fn<(event: GuideEvent) => void>()
    const tour: Tour = { id: 'demo', steps: [{ target: 'share', title: 'Here' }] }
    function StartShare() {
      const { startTour } = useHotspots()
      return <button onClick={() => startTour('share')}>start share</button>
    }
    render(
      <GuideProvider tours={[tour]} onEvent={onEvent}>
        <HotspotProvider hotspots={hotspots}>
          <button data-guide="share">share</button>
          <StartShare />
        </HotspotProvider>
      </GuideProvider>,
    )
    await user.click(screen.getByText('start share'))
    await waitFor(() =>
      expect(onEvent).toHaveBeenCalledWith({
        type: 'tour:start',
        tourId: 'demo',
        stepIndex: 0,
      }),
    )
  })
})
