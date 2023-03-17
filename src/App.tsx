import { Box, Button, Input, InputGroup, InputRightAddon, VStack } from '@chakra-ui/react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { harmonyOne } from '@wagmi/core/chains'
import { MetaMaskConnector } from '@wagmi/core/connectors/metaMask'
import debounce from 'lodash/debounce'
import * as CONFIG from '~/config'
import { baseRegistrar, nameWrapper } from './helpers/contracts'
import { getUnwrappedTokenId, getWrappedTokenId } from './helpers/tokenId'
import { useEffect } from 'react'

const App = () => {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect({
    connector: new MetaMaskConnector({
      chains: [harmonyOne]
    }),
  })
  const { disconnect } = useDisconnect()

  const handleDomainChange = debounce(async e => {
    const unwrappedTokenId = getUnwrappedTokenId(e.target.value)

    const owner = await baseRegistrar.functions.ownerOf(unwrappedTokenId)
    const wrapped = owner === CONFIG.nameWrapperAddress

    if (wrapped) {
      const wrappedTokenId = getWrappedTokenId(e.target.value)
      const tokenUri = await nameWrapper.tokenURI(wrappedTokenId)
      console.log(tokenUri)
    } else {
      const tokenUri = await baseRegistrar.tokenURI(unwrappedTokenId)
      console.log(tokenUri)
    }
  }, 500)

  if (!isConnected) {
    return <Button onClick={() => connect()}>Connect Wallet</Button>  
  }

  return (
    <VStack width="full">
      <Box>
        Connected to {address}
        <Button onClick={() => disconnect()}>Disconnect</Button>
      </Box>
      
      <InputGroup size='sm'>
        <Input placeholder='Second level domain' onChange={handleDomainChange} />
        <InputRightAddon children={`.${CONFIG.tld}`} />
      </InputGroup>
    </VStack>
  )
}

export default App
