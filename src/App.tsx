import React, { useState, useCallback, useEffect } from 'react'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
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
  useDisclosure,
  useToast,
  Text,
  VStack
} from '@chakra-ui/react'
import { useAccount, useConnect, useDisconnect, useSwitchNetwork, useNetwork } from 'wagmi'
import { readContract, prepareWriteContract, writeContract, signMessage } from '@wagmi/core'
import debounce from 'lodash/debounce'
import { getUnwrappedTokenId, getWrappedTokenId } from './helpers/tokenId'
import * as CONFIG from '~/config'
import * as ethers from 'ethers'
import { type Meta } from '~/types'
import Domain from './components/Domain'
import { useForm } from 'react-hook-form'
import { REGISTRAR_RELAY, requiredChainId, tld } from './config'
import axios from 'axios'

const base = axios.create({ timeout: 15000 })
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
  const { connect, connectors, error, isLoading, pendingConnector } = useConnect()
  const { chain } = useNetwork()
  const { switchNetwork } = useSwitchNetwork()
  const { disconnect } = useDisconnect()
  const [domain, setDomain] = useState<string>('')
  const [requestStatus, setRequestStatus] = useState<RequestStatus>()
  const [owner, setOwner] = useState<string>()
  const [wrappedOwner, setWrappedOwner] = useState<string>()
  const [tokenMeta, setTokenMeta] = useState<Meta>()
  const [tokenUri, setTokenUri] = useState<string>()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isOpenRedirect, onOpen: onOpenRedirect, onClose: onCloseRedirect } = useDisclosure()
  const toast = useToast()
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm()

  const {
    register: registerRedirect,
    handleSubmit: handleSubmitRedirect,
    formState: { errors: errorsRedirect }
  } = useForm()

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

  const wrapped = owner === CONFIG.nameWrapperContract.address

  const onTransferSubmit = useCallback(
    async (data: any) => {
      let config: any
      if (chain?.id !== requiredChainId) {
        return toast({ status: 'error', description: 'Connected to wrong network. Please switch to Harmony in your wallet' })
      }
      try {
        if (wrapped) {
          config = await prepareWriteContract({
            ...CONFIG.nameWrapperContract,
            functionName: 'safeTransferFrom',
            args: [
              address,
              data.transferTo,
              getWrappedTokenId(domain),
              1,
              '0x'
            ]
          })
        } else {
          config = await prepareWriteContract({
            ...CONFIG.baseRegistrarContract,
            functionName: 'safeTransferFrom',
            args: [
              address,
              data.transferTo,
              ethers.BigNumber.from(getUnwrappedTokenId(domain))
            ]
          })
        }

        await writeContract(config)
        toast({
          description: 'Transfer completed',
          status: 'success',
          isClosable: true
        })

        onClose()

        if (wrapped) {
          setWrappedOwner(data.transferTo)
        } else {
          setOwner(data.transferTo)
        }
      } catch (e) {
        toast({
          title: 'Transfer failed',
          description: (e as Error).message,
          status: 'error',
          isClosable: true
        })
      }
    },
    [address, domain, onClose, toast, wrapped, chain]
  )

  const onRedirectSubmit = useCallback(
    async (data: any) => {
      const deadline = Math.floor(Date.now() / 1000) + 600
      const targetDomain = data.host as string
      const subdomain = data.subdomain as string
      const signature = await signMessage({ message: `I want to map subdomain ${subdomain}.${domain}.${tld} to ${targetDomain}. This operation has to complete by timestamp ${deadline}` })
      console.log(signature)
      try {
        const { data: { success } } = await base.post(`${REGISTRAR_RELAY}/cname`, {
          deadline,
          subdomain,
          targetDomain,
          signature,
          domain: `${domain}.${tld}`
        })
        if (success) {
          toast({ status: 'success', description: `Successfully mapped ${subdomain}.${domain}.${tld} to ${targetDomain}` })
        }
        onCloseRedirect()
      } catch (ex: any) {
        console.error(ex)
        const error = ex?.response?.data?.error || ex.toString()
        toast({ status: 'error', description: `Failed to map subdomain. Error: ${error}` })
      }
    }, [domain, onCloseRedirect, toast])

  const activateSubdomains = useCallback(async () => {
    try {
      const { data: { success } } = await base.post(`${REGISTRAR_RELAY}/enable-subdomains`, { domain: `${domain}.${tld}` })
      if (success) {
        toast({ status: 'success', description: `Successfully activated Embedded Web Services for subdomains under ${domain}.${tld}` })
      }
    } catch (ex: any) {
      console.error(ex)
      const error = ex?.response?.data?.error || ex.toString()
      toast({ status: 'error', description: `Failed to activate Embedded Web Services. Error: ${error}` })
    }
  }, [domain, toast])

  const activateMail = useCallback(async () => {
    try {
      const { data: { success } } = await base.post(`${REGISTRAR_RELAY}/enable-mail`, { domain: `${domain}.${tld}` })
      if (success) {
        toast({ status: 'success', description: `Successfully activated Email Alias Service at mail.${domain}.${tld}` })
      }
    } catch (ex: any) {
      console.error(ex)
      const error = ex?.response?.data?.error || ex.toString()
      toast({ status: 'error', description: `Failed to activate Email Alias Service. Error: ${error}` })
    }
  }, [domain, toast])

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
                <Button flex={1} onClick={onOpen}>Transfer</Button>
                <Button flex={1} onClick={handleWrapClick}>
                  {wrapped ? 'Unwrap' : 'Wrap'}
                </Button>
              </HStack>
              <Button w={'100%'} onClick={onOpenRedirect}>
                Configure Subdomain CNAME Redirect
              </Button>
              <Button w={'100%'} onClick={activateMail}>
                Activate Email Alias Service
              </Button>
              <Button w={'100%'} onClick={activateSubdomains}>
                Activate Notion / Substack in Subdomains
              </Button>
            </VStack>
        )}
      </VStack>
      {requestStatus === RequestStatus.OK && tokenMeta && (
        <Domain meta={tokenMeta} />
      )}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSubmit(onTransferSubmit)}>
          <ModalHeader>Transfer</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isInvalid={!!errors.transferTo}>
              <FormLabel>Transfer the domain token to:</FormLabel>
              <Input
                autoFocus
                {...register('transferTo', {
                  required: true,
                  validate: { validAddress: (value) => /^0x[a-fA-F0-9]+$/.test(value) }
                })}
              />
              {errors.transferTo && (
                <FormErrorMessage>
                  {errors.transferTo.type === 'required'
                    ? 'Required'
                    : errors.transferTo.type === 'validAddress' &&
                      'Invalid address'}
                </FormErrorMessage>
              )}
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button type="submit">Transfer</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal isOpen={isOpenRedirect} onClose={onCloseRedirect}>
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSubmitRedirect(onRedirectSubmit)}>
          <ModalHeader>Redirect Subdomain (CNAME)</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isInvalid={!!errorsRedirect.subdomain}>
              <FormLabel>Subdomain</FormLabel>
              <Input
                  autoFocus
                  {...registerRedirect('subdomain', {
                    required: true,
                    validate: { validSubdomain: (value) => /^[a-z0-9-]+$/.test(value) }
                  })}
              />
              <FormLabel>Target Host</FormLabel>
              <Input
                  autoFocus
                  placeholder={'secret-server.harmony.one'}
                  {...registerRedirect('host', {
                    required: true,
                    validate: { validHost: (value) => /^[a-zA-Z0-9-.]+$/.test(value) }
                  })}
              />
              {errorsRedirect.subdomain && <FormErrorMessage>
                {errorsRedirect.subdomain.type === 'required' ? 'Required' : errorsRedirect.subdomain.type === 'validSubdomain' && 'Invalid subdomain'}
              </FormErrorMessage>}
              {errorsRedirect.host && <FormErrorMessage>
                {errorsRedirect.host.type === 'required' ? 'Required' : errorsRedirect.host.type === 'validHost' && 'Invalid host'}
              </FormErrorMessage>}
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button type="submit">Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  )
}

export default App
