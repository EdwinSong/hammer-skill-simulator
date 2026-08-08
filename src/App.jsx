import { Bc08Simulator } from './bc08/bc08simulator.jsx'
import I18nProvider from './bc08/i18n/I18nContext.jsx'

function App() {
  return (
    <I18nProvider>
      <Bc08Simulator />
    </I18nProvider>
  )
}

export default App
