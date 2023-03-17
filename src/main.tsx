import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider, Container } from '@chakra-ui/react'
import { WagmiConfig, createClient, configureChains } from 'wagmi'
import { harmonyOne } from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'
import App from './App'

const { provider, webSocketProvider } = configureChains(
  [harmonyOne],
  [publicProvider()],
)
 
const client = createClient({
  autoConnect: true,
  provider,
  webSocketProvider,
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ChakraProvider>
      <WagmiConfig client={client}>
        <Container my="5">
          <App />
        </Container>
      </WagmiConfig>
    </ChakraProvider>
  </React.StrictMode>,
)
