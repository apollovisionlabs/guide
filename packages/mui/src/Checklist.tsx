'use client'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import LinearProgress from '@mui/material/LinearProgress'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useChecklist, type ResolvedChecklistItem } from '@apollovisionlabs/guide-core'

export interface ChecklistLabels {
  dismiss: string
  progress: (completedCount: number, total: number) => string
  markComplete: (itemTitle: string) => string
  markNotComplete: (itemTitle: string) => string
}

const DEFAULT_LABELS: ChecklistLabels = {
  dismiss: 'Dismiss',
  progress: (completedCount, total) => `${completedCount} of ${total}`,
  markComplete: (itemTitle) => `Mark ${itemTitle} as complete`,
  markNotComplete: (itemTitle) => `Mark ${itemTitle} as not complete`,
}

export interface ChecklistProps {
  checklistId: string
  title?: string
  onDismiss?: () => void
  /** Called after an item is activated, with the resolved item that was activated. */
  onActivate?: (item: ResolvedChecklistItem) => void
  labels?: Partial<ChecklistLabels>
}

export function Checklist({ checklistId, title, onDismiss, onActivate, labels }: ChecklistProps) {
  const { items, completedCount, total, dismissed, restored, activate, toggle, dismiss } =
    useChecklist(checklistId)
  const text = { ...DEFAULT_LABELS, ...labels }

  // Nothing is drawn until the initial restore from storage has settled. Without this, a
  // checklist already dismissed, or partly completed, in storage would still render its
  // stale, pre-restore empty state for one paint: a dismissed list flashing its launcher, or
  // "0 of 4" jumping to "3 of 4".
  if (!restored) return null

  if (dismissed) return null

  // Rounded explicitly: MUI's own aria-valuenow rounding differs between v7 and v9, so the
  // component cannot rely on it to keep the accessibility tree consistent across versions.
  const progress = total === 0 ? 0 : Math.round((completedCount / total) * 100)

  return (
    <Box>
      {/* alignItems goes through sx rather than as a prop: MUI 9 dropped the system props on
          Stack, and this package supports both 7 and 9. */}
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
        {title && (
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
            {title}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ flexGrow: title ? 0 : 1 }}>
          {text.progress(completedCount, total)}
        </Typography>
        <Button
          size="small"
          onClick={() => {
            dismiss()
            onDismiss?.()
          }}
        >
          {text.dismiss}
        </Button>
      </Stack>
      <LinearProgress variant="determinate" value={progress} sx={{ mb: 1 }} />
      <List disablePadding>
        {items.map((item) => (
          <ListItem
            key={item.id}
            disablePadding
            secondaryAction={
              <Checkbox
                edge="end"
                checked={item.completed}
                slotProps={{
                  // slotProps rather than inputProps: MUI 9 removed the latter, and 7 accepts
                  // both, so this is the spelling that typechecks against either peer.
                  input: {
                    'aria-label': item.completed
                      ? text.markNotComplete(item.title)
                      : text.markComplete(item.title),
                  },
                }}
                onClick={() => toggle(item.id)}
              />
            }
          >
            <ListItemButton
              onClick={() => {
                activate(item.id)
                onActivate?.(item)
              }}
            >
              <ListItemText
                primary={item.title}
                secondary={item.body}
                slotProps={{
                  primary: { sx: { textDecoration: item.completed ? 'line-through' : 'none' } },
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )
}
