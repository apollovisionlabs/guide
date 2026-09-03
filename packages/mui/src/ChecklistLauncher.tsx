'use client'

import { useState, type MouseEvent } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Fab from '@mui/material/Fab'
import Popover from '@mui/material/Popover'
import { useChecklist, type ResolvedChecklistItem } from '@apollovisionlabs/guide-core'
import { Checklist } from './Checklist'

export interface ChecklistLauncherProps {
  checklistId: string
  title?: string
  placement?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
}

const CORNER_OFFSET = 24
const FAB_SIZE = 56
const RING_SIZE = 64
const RING_OFFSET = -((RING_SIZE - FAB_SIZE) / 2)

// Off-screen but still rendered, so it can hold focus and be read out. Not `display: none`
// and not `visibility: hidden`, neither of which can be focused.
const offScreenSx = {
  position: 'fixed' as const,
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap' as const,
  bottom: 0,
  left: 0,
}

function cornerSx(placement: NonNullable<ChecklistLauncherProps['placement']>) {
  return {
    position: 'fixed' as const,
    ...(placement.startsWith('bottom') ? { bottom: CORNER_OFFSET } : { top: CORNER_OFFSET }),
    ...(placement.endsWith('right') ? { right: CORNER_OFFSET } : { left: CORNER_OFFSET }),
  }
}

export function ChecklistLauncher({
  checklistId,
  title,
  placement = 'bottom-right',
}: ChecklistLauncherProps) {
  const { completedCount, total, dismissed } = useChecklist(checklistId)
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  // Set only when the dismissal happened here, in this session, from inside the popover. A
  // checklist that storage already reports as dismissed never sets it, so a returning user
  // gets nothing at all.
  const [dismissedHere, setDismissedHere] = useState(false)

  if (dismissed) {
    // Dismissing from inside the popover unmounts the Fab and the Popover in the same
    // commit, so MUI has no anchor left to restore focus to and a keyboard user is dropped
    // on document.body: no focus ring, no announcement, and the next Tab restarts at the top
    // of the page. The component is right to disappear, which is the whole point of a
    // dismissal, so the fix is not to keep the launcher on screen but to give focus a
    // deliberate destination at the place the launcher just left. This confirms the
    // dismissal, then removes itself the moment focus moves on, so nothing outlives the
    // announcement.
    if (!dismissedHere) return null
    return (
      <Box
        role="status"
        tabIndex={-1}
        ref={(node: HTMLDivElement | null) => {
          node?.focus()
        }}
        onBlur={() => setDismissedHere(false)}
        sx={offScreenSx}
      >
        {`${title ?? 'Checklist'} dismissed`}
      </Box>
    )
  }

  const open = Boolean(anchorEl)
  // Rounded explicitly for the same cross version reason as Checklist.tsx: MUI v7 rounds
  // aria-valuenow internally, MUI v9 does not, and both are supported peers.
  const progress = total === 0 ? 0 : Math.round((completedCount / total) * 100)
  const dialogLabel = title ?? 'Checklist'
  const fabLabel = `${dialogLabel}, ${completedCount} of ${total} complete`

  const close = () => setAnchorEl(null)
  const onDismiss = () => {
    close()
    setDismissedHere(true)
  }
  const onFabClick = (event: MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget)

  // Ticking items one after another is the normal way to use the list, so the popover must
  // stay open for a plain tick. It only closes when the activated item hands off to something
  // that needs the screen: a tour (which would otherwise be stuck behind an aria-hidden
  // launcher) or a navigation away from the current page.
  const onActivate = (item: ResolvedChecklistItem) => {
    if (item.tourId || item.href) close()
  }

  const fromBottom = placement.startsWith('bottom')
  const fromRight = placement.endsWith('right')

  return (
    <>
      <Box
        data-testid="checklist-launcher-anchor"
        sx={{
          ...cornerSx(placement),
          // One below the modal layer. The launcher must sit above ordinary application
          // chrome, a fixed app bar at 1100 or a drawer at 1200, or it vanishes behind
          // them; and below the tour's Spotlight, which paints at the modal layer, or it
          // stays bright over the dimmed page while the tour is meant to own the screen.
          zIndex: (theme) => theme.zIndex.modal - 1,
        }}
      >
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <CircularProgress
            variant="determinate"
            value={progress}
            size={RING_SIZE}
            thickness={3}
            aria-hidden="true"
            sx={{ position: 'absolute', top: RING_OFFSET, left: RING_OFFSET, pointerEvents: 'none' }}
          />
          <Fab color="primary" size="medium" aria-label={fabLabel} onClick={onFabClick}>
            {`${completedCount}/${total}`}
          </Fab>
        </Box>
      </Box>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: fromBottom ? 'top' : 'bottom', horizontal: fromRight ? 'right' : 'left' }}
        transformOrigin={{ vertical: fromBottom ? 'bottom' : 'top', horizontal: fromRight ? 'right' : 'left' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': dialogLabel,
            sx: { minWidth: 280, maxWidth: 360, p: 2 },
          },
        }}
      >
        <Checklist checklistId={checklistId} title={title} onDismiss={onDismiss} onActivate={onActivate} />
      </Popover>
    </>
  )
}
