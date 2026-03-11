import { useMetrone } from '@metrone-io/react'
import { useState } from 'react'

export default function Index() {
  const { trackEvent, trackConversion, trackAICall, trackAIChat } = useMetrone()
  const [buttonClicks, setButtonClicks] = useState(0)

  const handleButtonClick = (buttonId: string) => {
    setButtonClicks(prev => prev + 1)
    trackEvent('button_click', {
      button_id: buttonId,
      click_count: buttonClicks + 1
    })
  }

  const handleConversion = () => {
    trackConversion('purchase', 99.99, {
      product_id: 'example-product',
      currency: 'USD'
    })
  }

  const handleAICall = () => {
    trackAICall({
      call_id: `call_${Date.now()}`,
      provider: 'openai',
      duration: 45,
      intent: 'customer_support',
      outcome: 'resolved'
    })
  }

  const handleAIChat = () => {
    trackAIChat({
      session_id: `session_${Date.now()}`,
      provider: 'openai',
      message_count: 5,
      intent: 'product_inquiry',
      resolved: true
    })
  }

  return (
    <div className="container">
      <h1>Metrone Analytics - Remix Example</h1>
      
      <p>This example demonstrates how to use Metrone Analytics with Remix.</p>
      
      <div className="section">
        <h2>Event Tracking</h2>
        <p>Button clicks tracked: {buttonClicks}</p>
        <button onClick={() => handleButtonClick('example-button-1')}>
          Track Button Click 1
        </button>
        <button onClick={() => handleButtonClick('example-button-2')}>
          Track Button Click 2
        </button>
      </div>
      
      <div className="section">
        <h2>Conversion Tracking</h2>
        <button onClick={handleConversion}>
          Track Purchase ($99.99)
        </button>
      </div>
      
      <div className="section">
        <h2>AI Tracking</h2>
        <button onClick={handleAICall}>
          Track AI Call
        </button>
        <button onClick={handleAIChat}>
          Track AI Chat
        </button>
      </div>
      
      <div className="section">
        <h2>Installation</h2>
        <pre className="code">
{`npm install @metrone-io/sdk @metrone-io/react`}
        </pre>
      </div>
      
      <div className="section">
        <h2>Usage</h2>
        <pre className="code">
{`import { MetroneProvider, useMetrone } from '@metrone-io/react'

export default function App() {
  return (
    <MetroneProvider config={{ apiKey: 'metrone_live_xxx' }}>
      <Outlet />
    </MetroneProvider>
  )
}

function MyComponent() {
  const { trackEvent } = useMetrone()
  
  return (
    <button onClick={() => trackEvent('click')}>
      Track Click
    </button>
  )
}`}
        </pre>
      </div>
    </div>
  )
}
