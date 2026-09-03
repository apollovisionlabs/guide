'use client'

import { useState, type MouseEvent } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Fab from '@mui/material/Fab'
import Popover from '@mui/material/Popover'
import { useChecklist } from '@apollovisionlabs/guide-core'
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

  if (dismissed) return null

  const open = Boolean(anchorEl)
  // Rounded explicitly for the same cross version reason as Checklist.tsx: MUI v7 rounds
  // aria-valuenow internally, MUI v9 does not, and both are supported peers.
  const progress = total === 0 ? 0 : Math.round((completedCount / total) * 100)
  const dialogLabel = title ?? 'Checklist'
  const fabLabel = `${dialogLabel}, ${completedCount} of ${total} complete`

  const close = () => setAnchorEl(null)
  const onFabClick = (event: MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget)

  const fromBottom = placement.startsWith('bottom')
  const fromRight = placement.endsWith('right')

  return (
    <>
      <Box
        data-testid="checklist-launcher-anchor"
        sx={{ ...cornerSx(placement), zIndex: (theme) => theme.zIndex.speedDial }}
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
        <Checklist checklistId={checklistId} title={title} onDismiss={close} />
      </Popover>
    </>
  )
}
