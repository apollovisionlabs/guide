import { Route, Routes } from 'react-router'
import { MuiApp } from './MuiApp'
import { UnstyledApp } from './UnstyledApp'

export function App() {
  return (
    <Routes>
      <Route path="/unstyled/*" element={<UnstyledApp />} />
      <Route path="/*" element={<MuiApp />} />
    </Routes>
  )
}
