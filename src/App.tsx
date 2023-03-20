import { useState, useCallback, useRef } from 'react'
import {
  Box,
  Button,
  HStack,
  Input,
  InputGroup,
  InputRightAddon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
  VStack
} from '@chakra-ui/react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { readContract } from '@wagmi/core'
import { harmonyOne } from '@wagmi/core/chains'
import { MetaMaskConnector } from '@wagmi/core/connectors/metaMask'
import debounce from 'lodash/debounce'
import { getUnwrappedTokenId, getWrappedTokenId } from './helpers/tokenId'
import * as CONFIG from '~/config'
import { Meta } from '~/types'
import Domain from './components/Domain'

enum Error {
  OK = 0,
  NO_TOKEN = 'The domain token doesn\'t not exist your you are not owner of it',
  NO_URI = 'Token URI doesn\'t exist'
}

const App = () => {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect({
    connector: new MetaMaskConnector({
      chains: [harmonyOne]
    }),
  })
  const { disconnect } = useDisconnect()
  const [tokenMeta, setTokenMeta] = useState<Meta>()
  const [error, setError] = useState<Error>()
  const { isOpen, onOpen, onClose } = useDisclosure()

  const handleDomainChange = debounce(async e => {
    let tokenUri, owner

    const unwrappedTokenId = getUnwrappedTokenId(e.target.value)

    try {
      owner = await readContract({
        ...CONFIG.baseRegistrarContract,
        functionName: 'ownerOf',
        args: [unwrappedTokenId]
      })
    } catch {
      setError(Error.NO_TOKEN)
      return
    }

    const wrapped = owner === CONFIG.nameWrapperContract.address

    if (wrapped) {
      const wrappedTokenId = getWrappedTokenId(e.target.value)
      tokenUri = await readContract({
        ...CONFIG.nameWrapperContract,
        functionName: 'uri',
        args: [wrappedTokenId]
      })
    } else {
      tokenUri = await readContract({
        ...CONFIG.baseRegistrarContract,
        functionName: 'tokenURI',
        args: [unwrappedTokenId]
      })
    }

    try {
      const meta: Meta = await fetch(tokenUri as string).then(res => res.json())
      setTokenMeta(meta)
      setError(Error.OK)
    } catch {
      setError(Error.NO_URI)
    }
  }, 500)

  const handleTransferClick = useCallback(async () => {
    const unwrappedTokenId = getUnwrappedTokenId(e.target.value)

    const owner = await readContract({
      ...CONFIG.baseRegistrarContract,
      functionName: 'ownerOf',
      args: [unwrappedTokenId]
    })
  }, [])

  if (!isConnected) {
    return <Button onClick={() => connect()}>Connect Wallet</Button>  
  }

  return (
    <VStack width="full">
      <Box textAlign="center">
        Connected to {address}
        <Button onClick={() => disconnect()}>Disconnect</Button>
      </Box>
      
      <InputGroup size='sm'>
        <Input ref={domainRef} placeholder='Second level domain' onChange={handleDomainChange} />
        <InputRightAddon children={`.${CONFIG.tld}`} />
      </InputGroup>

      {error !== undefined && error !== Error.OK && (
        <HStack>
          <Button onClick={onOpen}>Transfer</Button>
          <Button>Wrap</Button>
        </HStack>
      )}

      {error === Error.OK ? tokenMeta && (
        <Domain meta={tokenMeta} />
      ) : <Text color="red">{error}</Text>}

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Transfer</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text as="label">
              Transfer the domain token to:
              <Input />
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button onClick={handleTransferClick}>
              Transfer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  )
}

export default App
