import { useState, useCallback } from "react"
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
  VStack,
} from "@chakra-ui/react"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { readContract, prepareWriteContract, writeContract } from "@wagmi/core"
import { harmonyOne } from "@wagmi/core/chains"
import { MetaMaskConnector } from "@wagmi/core/connectors/metaMask"
import debounce from "lodash/debounce"
import { getUnwrappedTokenId, getWrappedTokenId } from "./helpers/tokenId"
import * as CONFIG from "~/config"
import { Meta } from "~/types"
import Domain from "./components/Domain"
import { useForm } from "react-hook-form"

enum RequestStatus {
  OK = 0,
  PENDING = 1,
  NO_TOKEN = 2, // The domain token doesn't not exist your you are not owner of it,
  NO_URI = 3, // Token URI doesn't exist
}

const getTokenUri = (domain: string, wrapped: boolean) => {
  if (wrapped) {
    return readContract({
      ...CONFIG.nameWrapperContract,
      functionName: "uri",
      args: [getWrappedTokenId(domain)],
    })
  } else {
    return readContract({
      ...CONFIG.baseRegistrarContract,
      functionName: "tokenURI",
      args: [getUnwrappedTokenId(domain)],
    })
  }
}

const App = () => {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect({
    connector: new MetaMaskConnector({
      chains: [harmonyOne],
    }),
  })
  const { disconnect } = useDisconnect()
  const [domain, setDomain] = useState<string>("")
  const [requestStatus, setRequestStatus] = useState<RequestStatus>()
  const [owner, setOwner] = useState<string>()
  const [tokenMeta, setTokenMeta] = useState<Meta>()
  const [tokenUri, setTokenUri] = useState<string>()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const toast = useToast()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm()

  const handleDomainChange: React.ChangeEventHandler<HTMLInputElement> =
    debounce(async (e) => {
      setDomain(e.target.value)
      requestDomainData(e.target.value)
    }, 300)

  const requestDomainData = useCallback(async (domain: string) => {
    setRequestStatus(RequestStatus.PENDING)

    let owner: string

    try {
      owner = (await readContract({
        ...CONFIG.baseRegistrarContract,
        functionName: "ownerOf",
        args: [getUnwrappedTokenId(domain)],
      })) as string

      setOwner(owner)
    } catch {
      setRequestStatus(RequestStatus.NO_TOKEN)
      return
    }

    try {
      const tokenUri = (await getTokenUri(
        domain,
        owner === CONFIG.nameWrapperContract.address
      )) as string

      setTokenUri(tokenUri)

      const meta: Meta = await fetch(tokenUri).then((res) => res.json())

      setTokenMeta(meta)
      setRequestStatus(RequestStatus.OK)
    } catch {
      setRequestStatus(RequestStatus.NO_URI)
    }
  }, [])

  const wrapped = owner === CONFIG.nameWrapperContract.address

  const onTransferSubmit = useCallback(
    async (data) => {
      let config

      try {
        if (wrapped) {
          config = await prepareWriteContract({
            ...CONFIG.nameWrapperContract,
            functionName: "safeTransferFrom",
            args: [address, data.transferTo, getWrappedTokenId(domain), 1, ""],
          })
        } else {
          config = await prepareWriteContract({
            ...CONFIG.baseRegistrarContract,
            functionName: "safeTransferFrom",
            args: [address, data.transferTo, getUnwrappedTokenId(domain)],
          })
        }

        await writeContract(config)
        toast({
          description: "Transfer completed",
          status: "success",
          isClosable: true,
        })

        onClose()
        requestDomainData(domain)
      } catch (e) {
        toast({
          title: "Transfer failed",
          description: (e as Error).message,
          status: "error",
          isClosable: true,
        })
      }
    },
    [address, domain, onClose, requestDomainData, toast, wrapped]
  )

  const handleWrapClick = useCallback(async () => {
    let config

    try {
      if (wrapped) {
        config = await prepareWriteContract({
          ...CONFIG.nameWrapperContract,
          functionName: "unwrapETH2LD",
          args: [getUnwrappedTokenId(domain), address, address],
        })
      } else {
        const approved = await readContract({
          ...CONFIG.baseRegistrarContract,
          functionName: "isApprovedForAll",
          args: [address, CONFIG.nameWrapperContract.address],
        })

        if (!approved) {
          config = await prepareWriteContract({
            ...CONFIG.baseRegistrarContract,
            functionName: "setApprovalForAll",
            args: [CONFIG.nameWrapperContract.address, true],
          })

          await writeContract(config)
        }

        config = await prepareWriteContract({
          ...CONFIG.nameWrapperContract,
          functionName: "wrapETH2LD",
          args: [
            domain,
            address,
            0,
            "0xFFFFFFFFFFFFFFFF",
            CONFIG.resolverContract.address,
          ],
        })
      }

      await writeContract(config)

      toast({
        description: wrapped ? "Unwrap completed" : "Wrap completed",
        status: "success",
        isClosable: true,
      })

      setOwner(wrapped ? address : CONFIG.nameWrapperContract.address)
    } catch (e) {
      toast({
        title: wrapped ? "Unwrap failed" : "Wrap failed",
        description: (e as Error).message,
        status: "error",
        isClosable: true,
      })
    }
  }, [address, domain, toast, wrapped])

  if (!isConnected) {
    return <Button onClick={() => connect()}>Connect Wallet</Button>
  }

  return (
    <VStack width="full">
      <Box textAlign="center">
        Connected to {address}
        <Button onClick={() => disconnect()}>Disconnect</Button>
      </Box>

      <InputGroup size="sm">
        <Input
          autoFocus
          placeholder="Second level domain"
          onChange={handleDomainChange}
        />
        <InputRightAddon children={`.${CONFIG.tld}`} />
      </InputGroup>

      {requestStatus === RequestStatus.NO_TOKEN ? (
        <Alert status="error">
          <AlertIcon />
          The domain token doesn't exist
        </Alert>
      ) : (
        requestStatus === RequestStatus.NO_URI && (
          <Alert status="warning">
            <AlertIcon />
            Cannot load the token URI
            <br/>
            {tokenUri}
          </Alert>
        )
      )}

      {(requestStatus === RequestStatus.OK ||
        requestStatus === RequestStatus.NO_URI) && (
        <HStack>
          <Button onClick={onOpen}>Transfer</Button>
          <Button onClick={handleWrapClick}>
            {wrapped ? "Unwrap" : "Wrap"}
          </Button>
        </HStack>
      )}

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
                {...register("transferTo", {
                  required: true,
                  validate: {
                    validAddress: (value) => /^0x[a-fA-F0-9]+$/.test(value),
                  },
                })}
              />
              {errors.transferTo && (
                <FormErrorMessage>
                  {errors.transferTo.type === "required"
                    ? "Required"
                    : errors.transferTo.type === "validAddress" &&
                      "Invalid address"}
                </FormErrorMessage>
              )}
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button type="submit">Transfer</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  )
}

export default App
