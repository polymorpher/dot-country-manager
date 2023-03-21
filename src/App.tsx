import { useState, useCallback } from 'react'
import {
  Alert,
  AlertIcon,
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
  useToast,
  VStack
} from '@chakra-ui/react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { readContract, prepareWriteContract, writeContract } from '@wagmi/core'
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
  const [transferTo, setTransferTo] = useState<string>('')
  const [requestStatus, setRequestStatus] = useState<RequestStatus>()
  const [owner, setOwner] = useState<string>()
  const [tokenMeta, setTokenMeta] = useState<Meta>()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const toast = useToast()

  const handleDomainChange: React.ChangeEventHandler<HTMLInputElement> = debounce(async e => {
    setDomain(e.target.value)
    requestDomainData(e.target.value)
  }, 500)

  const requestDomainData = useCallback(async (domain: string) => {
    setRequestStatus(RequestStatus.PENDING)

    let owner: string

    try {
      owner = await readContract({
        ...CONFIG.baseRegistrarContract,
        functionName: 'ownerOf',
        args: [
          getUnwrappedTokenId(domain)
        ]
      }) as string

      setOwner(owner)
    } catch {
      setRequestStatus(RequestStatus.NO_TOKEN)
      return
    }

    try {
      const tokenUri = await getTokenUri(domain, owner) as string
      const meta: Meta = await fetch(tokenUri).then(res => res.json())

      setTokenMeta(meta)
      setRequestStatus(RequestStatus.OK)
    } catch {
      setRequestStatus(RequestStatus.NO_URI)
    }
  }, [])

  const wrapped = owner === CONFIG.nameWrapperContract.address

  const handleTransferClick = useCallback(async () => {
    let config

    if (wrapped) {
      config = await prepareWriteContract({
        ...CONFIG.nameWrapperContract,
        functionName: 'safeTransferFrom',
        args: [
          address,
          transferTo,
          getWrappedTokenId(domain),
          1,
          ''
        ]
      })
    } else {
      config = await prepareWriteContract({
        ...CONFIG.baseRegistrarContract,
        functionName: 'safeTransferFrom',
        args: [
          address,
          transferTo,
          getUnwrappedTokenId(domain)
        ]
      })
    }

    try {
      await writeContract(config)
      toast({
        description: 'Transfer completed',
        status: 'success',
        isClosable: true
      })

      onClose()
      requestDomainData(domain)
    } catch (e) {
      toast({
        title: 'Transfer failed',
        description: (e as Error).message,
        status: 'error',
        isClosable: true
      })
    }
  }, [address, domain, onClose, requestDomainData, toast, transferTo, wrapped])

  const handleWrapClick = useCallback(async () => {
    let config
    
    try {
      if (wrapped) {
        config = await prepareWriteContract({
          ...CONFIG.nameWrapperContract,
          functionName: 'unwrapETH2LD',
          args: [
            getUnwrappedTokenId(domain),
            address,
            address
          ]
        })
      } else {
        config = await prepareWriteContract({
          ...CONFIG.nameWrapperContract,
          functionName: 'wrapETH2LD',
          args: [
            domain,
            address,
            0,
            '0xFFFFFFFFFFFFFFFF',
            CONFIG.resolverContract.address
          ]
        })
      }
      
      await writeContract(config)

      toast({
        description: 'Unwrap completed',
        status: 'success',
        isClosable: true
      })
      requestDomainData(domain)
    } catch (e) {
      toast({
        title: 'Unwrap failed',
        description: (e as Error).message,
        status: 'error',
        isClosable: true
      })
    }
  }, [address, domain, requestDomainData, toast, wrapped])

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
        <Alert status="error">
          <AlertIcon />
          The domain token doesn't not exist or you are not owner of it
        </Alert >
      ) : requestStatus === RequestStatus.NO_URI && (
        <Alert status="warning">
          <AlertIcon />
          Token URI doesn't exist
        </Alert >
      )}

      {(requestStatus === RequestStatus.OK || requestStatus === RequestStatus.NO_URI)  && (
        <HStack>
          <Button onClick={onOpen}>Transfer</Button>
          <Button onClick={handleWrapClick}>
            {wrapped ? 'Unwrap' : 'Wrap'}
          </Button>
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
              <Input onChange={e => setTransferTo(e.target.value)} />
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
