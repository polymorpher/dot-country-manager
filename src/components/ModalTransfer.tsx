import { type UseDisclosureReturn } from '@chakra-ui/hooks/dist/use-disclosure'
import { useForm } from 'react-hook-form'
import {
  Button,
  FormControl, FormErrorMessage, FormLabel, Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent, ModalFooter,
  ModalHeader,
  ModalOverlay,
  useToast
} from '@chakra-ui/react'
import { useAccount, useNetwork } from 'wagmi'
import * as CONFIG from '~/config'
import React, { useCallback } from 'react'
import { requiredChainId } from '~/config'
import { prepareWriteContract, writeContract } from '@wagmi/core'
import { getUnwrappedTokenId, getWrappedTokenId } from '~/helpers/tokenId'
import * as ethers from 'ethers'

const ModalTransfer = ({ domain, control, owner, onComplete }: { domain: string, control: UseDisclosureReturn, owner?: string, onComplete?: (to: string) => void }): JSX.Element => {
  const { isOpen, onClose } = control
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm()
  const toast = useToast()
  const { chain } = useNetwork()
  const { address, isConnected } = useAccount()
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
        if (onComplete) {
          onComplete(data.transferTo)
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
    [address, domain, onClose, toast, wrapped, chain, onComplete]
  )

  return <Modal isOpen={isOpen} onClose={onClose}>
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
}

export default ModalTransfer
