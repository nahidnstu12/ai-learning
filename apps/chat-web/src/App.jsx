import './App.css'
import Chat from './components/Chat'
import OllamaStatus from './components/OllamaStatus'

function App() {
  return (
    <div className="app-shell">
      <OllamaStatus />
      <Chat />
    </div>
  )
}

export default App
