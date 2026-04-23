import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import { ExplorerPage } from './pages/ExplorerPage'
import { SetupPage } from './pages/SetupPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <ExplorerPage />,
      },
      {
        path: 'setup',
        element: <SetupPage />,
      },
    ],
  },
])
