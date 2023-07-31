import React, { useState, useCallback, useEffect } from 'react'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  HStack,
  Input,
  InputGroup,
  InputRightAddon,
  useDisclosure,
  useToast,
  Text,
  VStack
} from '@chakra-ui/react'
import { useAccount, useConnect, useDisconnect, useSwitchNetwork, useNetwork } from 'wagmi'
import { readContract, prepareWriteContract, writeContract } from '@wagmi/core'
import debounce from 'lodash/debounce'
import { getUnwrappedTokenId, getWrappedTokenId } from './helpers/tokenId'
import * as CONFIG from '~/config'
import { type Meta } from '~/types'
import Domain from './components/Domain'
import { requiredChainId } from './config'
import ModalTransfer from './components/ModalTransfer'
import ModalCanonicalName from './components/ModalCanonicalName'
import { useDnsControl } from '~/components/hooks'
import ModalRedirect from '~/components/ModalRedirect'
import { DNS_MAINTAINERS } from '~/config'

enum RequestStatus {
  OK = 0,
  PENDING = 1,
  NO_TOKEN = 2, // The domain token doesn't not exist your you are not owner of it,
  NO_URI = 3, // Token URI doesn't exist
}

const getTokenUri = async (domain: string, wrapped: boolean): Promise<string> => {
  if (wrapped) {
    return await readContract({
      ...CONFIG.nameWrapperContract,
      functionName: 'uri',
      args: [getWrappedTokenId(domain)]
    }) as string
  } else {
    return await readContract({
      ...CONFIG.baseRegistrarContract,
      functionName: 'tokenURI',
      args: [getUnwrappedTokenId(domain)]
    }) as string
  }
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount()
  const { chain } = useNetwork()
  const { connect, connectors, error, isLoading, pendingConnector } = useConnect()
  const { switchNetwork } = useSwitchNetwork()
  const { disconnect } = useDisconnect()
  const [domain, setDomain] = useState<string>('')
  const [requestStatus, setRequestStatus] = useState<RequestStatus>()
  const [owner, setOwner] = useState<string>()
  const [wrappedOwner, setWrappedOwner] = useState<string>()
  const [tokenMeta, setTokenMeta] = useState<Meta>()
  const [tokenUri, setTokenUri] = useState<string>()
  const transferModalControl = useDisclosure()
  const canonicalNameModalControl = useDisclosure()
  const redirectModalControl = useDisclosure()
  const toast = useToast()
  const { activateSubdomains, activateMail } = useDnsControl({ domain })
  const wrapped = owner === CONFIG.nameWrapperContract.address

  const handleDomainChange: React.ChangeEventHandler<HTMLInputElement> =
    debounce(async (e) => {
      setDomain(e.target.value)
      await requestDomainData(e.target.value)
    }, 300)

  const requestDomainData = useCallback(async (domain: string) => {
    setRequestStatus(RequestStatus.PENDING)

    let owner: string

    try {
      owner = (await readContract({
        ...CONFIG.baseRegistrarContract,
        functionName: 'ownerOf',
        args: [getUnwrappedTokenId(domain)]
      })) as string

      setOwner(owner)
    } catch (e) {
      console.error('failed to load the token: ', e)
      setRequestStatus(RequestStatus.NO_TOKEN)
      return
    }

    try {
      if (owner === CONFIG.nameWrapperContract.address) {
        const wrappedOwner = (await readContract({
          ...CONFIG.nameWrapperContract,
          functionName: 'ownerOf',
          args: [getWrappedTokenId(domain)]
        })) as string

        setWrappedOwner(wrappedOwner)
      }
    } catch (e) {
      toast({
        title: 'Failed to get owner of the token',
        description: (e as Error).message,
        status: 'error',
        isClosable: true
      })
    }

    try {
      const tokenUri = (await getTokenUri(
        domain,
        owner === CONFIG.nameWrapperContract.address
      ))

      setTokenUri(tokenUri)

      const meta: Meta = await fetch(tokenUri).then(async (res) => await res.json())

      setTokenMeta(meta)
      setRequestStatus(RequestStatus.OK)
    } catch (e) {
      console.error('failed to load the token URI: ', e)
      setRequestStatus(RequestStatus.NO_URI)
    }
  }, [toast])

  const handleWrapClick = useCallback(async () => {
    let config: any = null
    if (chain?.id !== requiredChainId) {
      return toast({ status: 'error', description: 'Connected to wrong network. Please switch to Harmony in your wallet' })
    }

    try {
      if (wrapped) {
        config = await prepareWriteContract({
          ...CONFIG.nameWrapperContract,
          functionName: 'unwrapETH2LD',
          args: [getUnwrappedTokenId(domain), address, address]
        })
      } else {
        const approved = await readContract({
          ...CONFIG.baseRegistrarContract,
          functionName: 'isApprovedForAll',
          args: [address, CONFIG.nameWrapperContract.address]
        })

        if (!approved) {
          config = await prepareWriteContract({
            ...CONFIG.baseRegistrarContract,
            functionName: 'setApprovalForAll',
            args: [CONFIG.nameWrapperContract.address, true]
          })

          await writeContract(config)
        }

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
        description: wrapped ? 'Unwrap completed' : 'Wrap completed',
        status: 'success',
        isClosable: true
      })

      if (wrapped) {
        setOwner(address)
      } else {
        setOwner(CONFIG.nameWrapperContract.address)
        setWrappedOwner(address)
      }
    } catch (e) {
      toast({
        title: wrapped ? 'Unwrap failed' : 'Wrap failed',
        description: (e as Error).message,
        status: 'error',
        isClosable: true
      })
    }
  }, [address, domain, toast, wrapped, chain])

  useEffect(() => {
    if (!isConnected || !chain || !switchNetwork) {
      return
    }
    if (chain.id !== requiredChainId) {
      console.log(requiredChainId)
      switchNetwork(requiredChainId)
    }
  }, [isConnected, chain, switchNetwork])

  if (!isConnected) {
    return <VStack>
      <Text pb={8}>Please connect your wallet</Text>
      {connectors.map((connector) => (
        <Button
            maxW={200} w={'100%'}
              isDisabled={!connector.ready}
              key={connector.id}
              onClick={() => { connect({ connector }) }}
          >
          {connector.name}
          {isLoading &&
                connector.id === pendingConnector?.id &&
                ' (...)'}
        </Button>
      ))}

      {error && <div>{error.message}</div>}
    </VStack>
  }
  const isDnsAccessible: boolean = (address && owner?.toLowerCase() === address?.toLowerCase()) ?? DNS_MAINTAINERS.includes(address?.toLowerCase() ?? '')

  return (
    <VStack width="full">
      <VStack mb={8} align={'center'}>
        <Box textAlign="center">
          <Text pb={4}>Connected to {chain?.name} <br/> {address}</Text>
          <Button onClick={() => { disconnect() }}>Disconnect</Button>
        </Box>
        <Box alignContent={'center'} py={8}>
          <InputGroup size="sm">
            <Input
              w={240}
              autoFocus
              placeholder="Second level domain"
              onChange={handleDomainChange}
            />
            <InputRightAddon>.{CONFIG.tld}</InputRightAddon>
          </InputGroup>
        </Box>
        {requestStatus === RequestStatus.NO_TOKEN
          ? (
            <Alert status="error">
              <AlertIcon />
              The domain token does not exist
            </Alert>
            )
          : (
              requestStatus === RequestStatus.NO_URI && (
              <Alert status="warning" overflowWrap="anywhere">
                <AlertIcon />
                Cannot load the token URI
                <br />
                {tokenUri}
              </Alert>
              )
            )}
        {(requestStatus === RequestStatus.OK ||
          requestStatus === RequestStatus.NO_URI) &&
          ((wrapped && wrappedOwner === address) ||
            (!wrapped && owner === address)) && (
            <VStack>
              <HStack>
                <Button flex={1} onClick={transferModalControl.onOpen}>Transfer</Button>
                <Button flex={1} onClick={handleWrapClick}>
                  {wrapped ? 'Unwrap' : 'Wrap'}
                </Button>
              </HStack>
            </VStack>
        )}
        {isDnsAccessible && <VStack>
          <Button w={'100%'} onClick={canonicalNameModalControl.onOpen}>
            Configure Subdomain Alias
          </Button>
          <Button w={'100%'} onClick={redirectModalControl.onOpen}>
            Configure URL Redirect
          </Button>
        </VStack>}
        {address && <VStack>
          <Button w={'100%'} onClick={activateMail}>
            Activate Email Alias Service
          </Button>
          <Button w={'100%'} onClick={activateSubdomains}>
            Activate Notion / Substack in Subdomains
          </Button>
        </VStack>}
      </VStack>

      {requestStatus === RequestStatus.OK && tokenMeta && (
        <Domain meta={tokenMeta} />
      )}

      <ModalTransfer domain={domain} control={transferModalControl} owner={owner} onComplete={(to: string) => { wrapped ? setWrappedOwner(to) : setOwner(to) }}/>
      <ModalCanonicalName domain={domain} control={canonicalNameModalControl}/>
      <ModalRedirect domain={domain} control={redirectModalControl}/>
    </VStack>
  )
}

export default App
