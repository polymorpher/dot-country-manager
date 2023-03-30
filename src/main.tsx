import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider, Container } from '@chakra-ui/react'
import { WagmiConfig, createClient, configureChains } from 'wagmi'
import { harmonyOne } from 'wagmi/chains'
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'
import App from './App'
import { rpcProvider, walletConnectProjectId } from '~/config'

import { MetaMaskConnector } from 'wagmi/connectors/metaMask'
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect'
// import { InjectedConnector } from 'wagmi/connectors/injected'

const { chains, provider, webSocketProvider } = configureChains(
  [harmonyOne],
  [jsonRpcProvider({ rpc: (chain) => ({ http: rpcProvider }) })]
)

const client = createClient({
  autoConnect: true,
  connectors: [
    new MetaMaskConnector({ chains }),
    // new InjectedConnector({ chains }),
    new WalletConnectConnector({
      chains,
      options: { projectId: walletConnectProjectId }
    })
  ],
  provider,
  webSocketProvider
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ChakraProvider>
      <WagmiConfig client={client}>
        <Container my="8">
          <App />
        </Container>
      </WagmiConfig>
    </ChakraProvider>
  </React.StrictMode>
)
