import { useState } from 'react'
import { Box, Button, Input, InputGroup, InputRightAddon, VStack } from '@chakra-ui/react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { readContract } from '@wagmi/core'
import { harmonyOne } from '@wagmi/core/chains'
import { MetaMaskConnector } from '@wagmi/core/connectors/metaMask'
import debounce from 'lodash/debounce'
import { getUnwrappedTokenId, getWrappedTokenId } from './helpers/tokenId'
import * as CONFIG from '~/config'
import { Meta } from './types'
import Domain from './components/Domain'

const App = () => {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect({
    connector: new MetaMaskConnector({
      chains: [harmonyOne]
    }),
  })
  const { disconnect } = useDisconnect()
  const [tokenMeta, setTokenMeta] = useState<Meta>()

  const handleDomainChange = debounce(async e => {
    let tokenUri: string
    const unwrappedTokenId = getUnwrappedTokenId(e.target.value)

    const owner = await readContract({
      ...CONFIG.baseRegistrarContract,
      functionName: 'ownerOf',
      args: [unwrappedTokenId]
    })

    const wrapped = owner === CONFIG.nameWrapperContract.address

    if (wrapped) {
      const wrappedTokenId = getWrappedTokenId(e.target.value)
      tokenUri = await readContract({
        ...CONFIG.nameWrapperContract,
        functionName: 'uri',
        args: [wrappedTokenId]
      }) as string
    } else {
      tokenUri = await readContract({
        ...CONFIG.baseRegistrarContract,
        functionName: 'tokenURI',
        args: [unwrappedTokenId]
      }) as string
    }

    const meta: Meta = await fetch(tokenUri).then(res => res.json())
    setTokenMeta(meta)
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

      {tokenMeta && (
        <Domain meta={tokenMeta} />
      )}
    </VStack>
  )
}

export default App
