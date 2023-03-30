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
  Text,
  VStack,
} from "@chakra-ui/react"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { readContract, prepareWriteContract, writeContract } from "@wagmi/core"
import { harmonyOne } from "@wagmi/core/chains"
import { MetaMaskConnector } from "@wagmi/core/connectors/metaMask"
import debounce from "lodash/debounce"
import { getUnwrappedTokenId, getWrappedTokenId } from "./helpers/tokenId"
import * as CONFIG from "~/config"
import * as ethers from "ethers"
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
  const [wrappedOwner, setWrappedOwner] = useState<string>()
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
    } catch (e) {
      console.error("failed to load the token: ", e)
      setRequestStatus(RequestStatus.NO_TOKEN)
      return
    }

    try {
      if (owner === CONFIG.nameWrapperContract.address) {
        const wrappedOwner = (await readContract({
          ...CONFIG.nameWrapperContract,
          functionName: "ownerOf",
          args: [getWrappedTokenId(domain)],
        })) as string

        setWrappedOwner(wrappedOwner)
      }
    } catch (e) {
      toast({
        title: "Failed to get owner of the token",
        description: (e as Error).message,
        status: "error",
        isClosable: true,
      })
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
    } catch (e) {
      console.error("failed to load the token URI: ", e)
      setRequestStatus(RequestStatus.NO_URI)
    }
  }, [toast])

  const wrapped = owner === CONFIG.nameWrapperContract.address

  const onTransferSubmit = useCallback(
    async (data: any) => {
      let config: any

      try {
        if (wrapped) {
          config = await prepareWriteContract({
            ...CONFIG.nameWrapperContract,
            functionName: "safeTransferFrom",
            args: [
              address,
              data.transferTo,
              getWrappedTokenId(domain),
              1,
              "0x",
            ],
          })
        } else {
          config = await prepareWriteContract({
            ...CONFIG.baseRegistrarContract,
            functionName: "safeTransferFrom",
            args: [
              address,
              data.transferTo,
              ethers.BigNumber.from(getUnwrappedTokenId(domain)),
            ],
          })
        }

        await writeContract(config)
        toast({
          description: "Transfer completed",
          status: "success",
          isClosable: true,
        })

        onClose()

        if (wrapped) {
          setWrappedOwner(data.transferTo)
        } else {
          setOwner(data.transferTo)
        }
      } catch (e) {
        toast({
          title: "Transfer failed",
          description: (e as Error).message,
          status: "error",
          isClosable: true,
        })
      }
    },
    [address, domain, onClose, toast, wrapped]
  )

  const handleWrapClick = useCallback(async () => {
    let config: any = null

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

      if (wrapped) {
        setOwner(address)
      } else {
        setOwner(CONFIG.nameWrapperContract.address)
        setWrappedOwner(address)
      }
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
      <VStack mb={8} align={"center"}>
        <Box textAlign="center">
          <Text pb={4}>Connected to {address}</Text>
          <Button onClick={() => disconnect()}>Disconnect</Button>
        </Box>
        <Box alignContent={"center"} py={8}>
          <InputGroup size="sm">
            <Input
              w={240}
              autoFocus
              placeholder="Second level domain"
              onChange={handleDomainChange}
            />
            <InputRightAddon children={`.${CONFIG.tld}`} />
          </InputGroup>
        </Box>
        {requestStatus === RequestStatus.NO_TOKEN ? (
          <Alert status="error">
            <AlertIcon />
            The domain token doesn't exist
          </Alert>
        ) : (
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
            <HStack>
              <Button onClick={onOpen}>Transfer</Button>
              <Button onClick={handleWrapClick}>
                {wrapped ? "Unwrap" : "Wrap"}
              </Button>
            </HStack>
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
