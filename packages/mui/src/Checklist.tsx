'use client'

import type { MouseEvent } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import LinearProgress from '@mui/material/LinearProgress'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useChecklist } from '@apollovisionlabs/guide-core'

export interface ChecklistProps {
  checklistId: string
  title?: string
  onDismiss?: () => void
}

export function Checklist({ checklistId, title, onDismiss }: ChecklistProps) {
  const { items, completedCount, total, dismissed, activate, toggle, dismiss } =
    useChecklist(checklistId)

  if (dismissed) return null

  // Rounded explicitly: MUI's own aria-valuenow rounding differs between v7 and v9, so the
  // component cannot rely on it to keep the accessibility tree consistent across versions.
  const progress = total === 0 ? 0 : Math.round((completedCount / total) * 100)

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        {title && (
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
            {title}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ flexGrow: title ? 0 : 1 }}>
          {`${completedCount} of ${total}`}
        </Typography>
        <Button
          size="small"
          onClick={() => {
            dismiss()
            onDismiss?.()
          }}
        >
          Dismiss
        </Button>
      </Stack>
      <LinearProgress variant="determinate" value={progress} sx={{ mb: 1 }} />
      <List disablePadding>
        {items.map((item) => (
          <ListItemButton key={item.id} onClick={() => activate(item.id)}>
            <ListItemIcon>
              <Checkbox
                edge="start"
                checked={item.completed}
                inputProps={{ 'aria-label': item.title }}
                onClick={(event: MouseEvent<HTMLElement>) => {
                  event.stopPropagation()
                  toggle(item.id)
                }}
              />
            </ListItemIcon>
            <ListItemText
              primary={item.title}
              secondary={item.body}
              slotProps={{
                primary: { sx: { textDecoration: item.completed ? 'line-through' : 'none' } },
              }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )
}
