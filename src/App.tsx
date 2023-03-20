import { useState } from 'react'
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

enum RequestStatus {
  OK = 0,
  PENDING = 1,
  NO_TOKEN = 2, // The domain token doesn't not exist your you are not owner of it,
  NO_URI = 3, // Token URI doesn't exist
}

const getTokenUri = (domain: string, owner: string) => {
  const wrapped = owner === CONFIG.nameWrapperContract.address

  if (wrapped) {
    return readContract({
      ...CONFIG.nameWrapperContract,
      functionName: 'uri',
      args: [
        getWrappedTokenId(domain)
      ]
    })
  } else {
    return readContract({
      ...CONFIG.baseRegistrarContract,
      functionName: 'tokenURI',
      args: [
        getUnwrappedTokenId(domain)
      ]
    })
  }
}

const App = () => {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect({
    connector: new MetaMaskConnector({
      chains: [harmonyOne]
    }),
  })
  const { disconnect } = useDisconnect()
  const [domain, setDomain] = useState<string>('')
  const [requestStatus, setRequestStatus] = useState<RequestStatus>()
  const [owner, setOwner] = useState<string>()
  const [tokenMeta, setTokenMeta] = useState<Meta>()
  const { isOpen, onOpen, onClose } = useDisclosure()

  const handleDomainChange: React.ChangeEventHandler<HTMLInputElement> = debounce(async e => {
    setRequestStatus(RequestStatus.PENDING)
    setDomain(e.target.value)

    let owner: string

    try {
      owner = await readContract({
        ...CONFIG.baseRegistrarContract,
        functionName: 'ownerOf',
        args: [
          getUnwrappedTokenId(e.target.value)
        ]
      }) as string

      setOwner(owner)
    } catch {
      setRequestStatus(RequestStatus.NO_TOKEN)
      return
    }

    try {
      const tokenUri = await getTokenUri(e.target.value, owner) as string
      const meta: Meta = await fetch(tokenUri).then(res => res.json())

      setTokenMeta(meta)
      setRequestStatus(RequestStatus.OK)
    } catch {
      setRequestStatus(RequestStatus.NO_URI)
    }
  }, 500)

  const wrapped = owner === CONFIG.nameWrapperContract.address

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
        <Input
          placeholder='Second level domain'
          onChange={handleDomainChange}
        />
        <InputRightAddon children={`.${CONFIG.tld}`} />
      </InputGroup>

      {requestStatus === RequestStatus.NO_TOKEN ? (
        <Text color="red">
          The domain token doesn't not exist your you are not owner of it
        </Text>
      ) : requestStatus === RequestStatus.NO_URI && (
        <Text color="red">
          Token URI doesn't exist
        </Text>
      )}

      {(requestStatus === RequestStatus.OK || requestStatus === RequestStatus.NO_URI)  && (
        <HStack>
          <Button onClick={onOpen}>Transfer</Button>
          <Button>Wrap</Button>
        </HStack>
      )}

      {requestStatus === RequestStatus.OK && tokenMeta && (
        <Domain meta={tokenMeta} />
      )}

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
            <Button>
              Transfer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  )
}

export default App
