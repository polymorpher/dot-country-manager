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
  VStack, StackDivider
} from '@chakra-ui/react'
import { useAccount, useConnect, useDisconnect, useSwitchNetwork, useNetwork } from 'wagmi'
import { readContract, prepareWriteContract, writeContract } from '@wagmi/core'
import debounce from 'lodash/debounce'
import { getUnwrappedTokenId, getWrappedTokenId } from './helpers/tokenId'
import * as CONFIG from '~/config'
import { type Meta } from '~/types'
import Domain, { isExpiryTimeInconsistent } from './components/Domain'
import { requiredChainId } from './config'
import ModalTransfer from './components/ModalTransfer'
import ModalCanonicalName from './components/ModalCanonicalName'
import { useDnsControl } from '~/components/hooks'
import ModalRedirect from '~/components/ModalRedirect'
import { DNS_MAINTAINERS } from '~/config'
import { type BigNumber } from 'ethers'

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
  const [expiryTime, setExpiryTime] = useState<number>(0)
  const [wrappedOwner, setWrappedOwner] = useState<string>()
  const [tokenMeta, setTokenMeta] = useState<Meta>()
  const [, setTokenUri] = useState<string>()
  const transferModalControl = useDisclosure()
  const canonicalNameModalControl = useDisclosure()
  const redirectModalControl = useDisclosure()
  const toast = useToast()
  const { activateSubdomains, activateMail, genCert, renewCert, genMetadata, renewMetadata } = useDnsControl({ domain })
  const wrapped = owner === CONFIG.nameWrapperContract.address
  const [dnsOperationPending, setDnsOperationPending] = useState(false)

  const handleGenMetadata = useCallback(async () => {
    setDnsOperationPending(true)
    try {
      await genMetadata()
    } catch (ex: any) {
      console.error(ex)
    }
    setDnsOperationPending(false)
  }, [genMetadata])
  const handleRenewMetadata = useCallback(async () => {
    setDnsOperationPending(true)
    try {
      await renewMetadata()
    } catch (ex: any) {
      console.error(ex)
    }
    setDnsOperationPending(false)
  }, [renewMetadata])
  const handleGenerateSSL = useCallback(async (): Promise<void> => {
    setDnsOperationPending(true)
    try {
      await genCert()
    } catch (ex: any) {
      console.error(ex)
    }
    setDnsOperationPending(false)
  }, [genCert])
  const handleRenewSSL = useCallback(async () => {
    setDnsOperationPending(true)
    try {
      await renewCert()
    } catch (ex: any) {
      console.error(ex)
    }
    setDnsOperationPending(false)
  }, [renewCert])

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
        console.log({ owner, wrappedOwner })
      }
    } catch (e) {
      toast({
        title: 'Failed to get owner of the token',
        description: (e as Error).message,
        status: 'error',
        isClosable: true
      })
    }

    let tokenUri
    try {
      tokenUri = (await getTokenUri(
        domain,
        owner === CONFIG.nameWrapperContract.address
      ))
      const uri = new URL(tokenUri)
      if (!uri.search) {
        uri.search = '?' + Math.random().toString(26).slice(2)
      }

      setTokenUri(uri.toString())
      console.log(`tokenUri ${uri.toString()}`)

      const meta: Meta = await fetch(uri.toString()).then(async (res) => await res.json())
      console.log(meta)
      setTokenMeta(meta)
      setRequestStatus(RequestStatus.OK)
    } catch (e) {
      console.error('failed to load the token URI: ', e)
      setRequestStatus(RequestStatus.NO_URI)
    }

    try {
      const expiry = (await readContract({
        ...CONFIG.baseRegistrarContract,
        functionName: 'nameExpires',
        args: [getUnwrappedTokenId(domain)]
      })) as BigNumber
      console.log('Expiry time: ', expiry.toNumber())
      setExpiryTime(expiry.toNumber() * 1000)
    } catch (e) {
      console.error('Failed to lookup expiry time.', e)
      setRequestStatus(RequestStatus.NO_TOKEN)
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
  const isDnsAccessible: boolean = !!domain && ((owner?.toLowerCase() === address?.toLowerCase()) || (wrappedOwner?.toLowerCase() === address?.toLowerCase()) || DNS_MAINTAINERS.includes(address?.toLowerCase() ?? ''))

  return (
    <VStack width="full">
      <VStack mb={8} align={'center'} divider={<StackDivider borderColor='gray.200' />}>
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
              <VStack mb={'32px'}>
                <Alert status="warning" overflowWrap="anywhere">
                  <AlertIcon mr={2} />
                  Cannot load the token metadata
                </Alert>
                <Button isDisabled={dnsOperationPending} onClick={handleGenMetadata}>Regenerate Metadata</Button>
              </VStack>
              )
            )}
        {(requestStatus === RequestStatus.OK ||
          requestStatus === RequestStatus.NO_URI) &&
          ((wrapped && wrappedOwner === address) ||
            (!wrapped && owner === address)) && (
            <VStack width="full">
              <HStack width="full">
                <Button flex={1} onClick={transferModalControl.onOpen}>Transfer</Button>
                <Button flex={1} onClick={handleWrapClick}>
                  {wrapped ? 'Unwrap' : 'Wrap'}
                </Button>
              </HStack>
            </VStack>
        )}
        {isDnsAccessible && <VStack width="full">
          <Button w={'100%'} onClick={canonicalNameModalControl.onOpen}>
            Configure Subdomain Alias
          </Button>
          <Button w={'100%'} onClick={redirectModalControl.onOpen}>
            Configure URL Redirect
          </Button>
          <Button w={'100%'} onClick={redirectModalControl.onOpen}>
            Renew Domain
          </Button>
        </VStack>}
        {isDnsAccessible && <HStack width="full">
          <Button isDisabled={dnsOperationPending} w={'100%'} onClick={handleGenerateSSL}>
            Generate SSL Cert
          </Button>
          <Button isDisabled={dnsOperationPending} w={'100%'} onClick={handleRenewSSL}>
            Renew SSL Cert
          </Button>
        </HStack>}
        {domain && <VStack width="full">
          <Button w={'100%'} isDisabled={dnsOperationPending} onClick={activateMail}>
            Activate Email Alias Service
          </Button>
          <Button w={'100%'} isDisabled={dnsOperationPending} onClick={activateSubdomains}>
            Activate Notion / Substack in Subdomains
          </Button>
        </VStack>}
      </VStack>

      {requestStatus === RequestStatus.OK && tokenMeta && (
        <Domain meta={tokenMeta} />
      )}
      {requestStatus === RequestStatus.OK && tokenMeta && isExpiryTimeInconsistent(tokenMeta, expiryTime) && (
        <VStack>
          <Alert status="error">
            The domain metadata card is outdated
          </Alert>
          <Button isDisabled={dnsOperationPending} w={'100%'} onClick={handleRenewMetadata}>
            Renew metadata
          </Button>
        </VStack>
      ) }

      <ModalTransfer domain={domain} control={transferModalControl} owner={owner} onComplete={(to: string) => { wrapped ? setWrappedOwner(to) : setOwner(to) }}/>
      <ModalCanonicalName domain={domain} control={canonicalNameModalControl}/>
      <ModalRedirect domain={domain} control={redirectModalControl}/>
    </VStack>
  )
}

export default App
