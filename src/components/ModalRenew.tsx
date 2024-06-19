import { type UseDisclosureReturn } from '@chakra-ui/hooks/dist/use-disclosure'
import {
  Button,
  NumberInput,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent, ModalFooter,
  ModalHeader,
  ModalOverlay, Text,
  useToast, NumberInputStepper, NumberDecrementStepper, NumberInputField, NumberIncrementStepper
} from '@chakra-ui/react'
import { prepareWriteContract, readContract, writeContract } from '@wagmi/core'
import { requiredChainId, tld } from '~/config'
import React, { useCallback, useEffect, useState } from 'react'
import * as CONFIG from '~/config'
import { type BigNumber, ethers } from 'ethers'
import { useNetwork } from 'wagmi'

const getDurationInSeconds = (months: number): number => {
  const now = new Date()
  const d = new Date()
  const targetTime = new Date(d.setMonth(d.getMonth() + months))
  return Math.floor((targetTime.getTime() - now.getTime()) / 1000)
}

const ModalRenew = ({ domain, control }: { domain: string, control: UseDisclosureReturn }): JSX.Element => {
  const [durationInput, setDurationInput] = useState<number>(12)
  const [cost, setCost] = useState<string>('0')
  const { chain } = useNetwork()
  const { isOpen, onClose } = control

  const toast = useToast()
  useEffect(() => {
    async function refreshCost (): Promise<void> {
      const duration = getDurationInSeconds(durationInput)
      const priceStruct = await readContract({
        ...CONFIG.registrarControllerContract,
        functionName: 'rentPrice',
        args: [domain, duration]
      })
      // console.log(priceStruct)
      const price = ((priceStruct as any).base as BigNumber).add((priceStruct as any).premium)
      setCost(price.toString())
    }
    refreshCost().catch(ex => { console.error(ex) })
  }, [domain, durationInput])
  const renew = useCallback(async (): Promise<void> => {
    if (!(durationInput >= 1 && durationInput <= 12 && Math.floor(durationInput) === durationInput)) {
      toast({ status: 'error', description: 'Duration must be an integer between 1 to 12 months' })
      return
    }
    if (chain?.id !== requiredChainId) {
      toast({ status: 'error', description: 'Connected to wrong network. Please switch to Harmony in your wallet' })
      return
    }
    try {
      const duration = getDurationInSeconds(durationInput)
      // console.log({ domain, duration, cost })
      const config = await prepareWriteContract({
        ...CONFIG.registrarControllerContract,
        functionName: 'renew',
        value: cost,
        args: [domain, duration]
      })

      const result = await writeContract(config)
      toast({ status: 'success', description: `Successfully renewed ${domain}.${tld} for ${durationInput} months. tx: ${result.hash}` })
      onClose()
    } catch (ex: any) {
      console.error(ex)
      const error = ex?.response?.data?.error || ex.toString()
      toast({ status: 'error', description: `Failed to renew domain. Error: ${error}` })
    }
  }, [chain, cost, onClose, durationInput, toast, domain])

  return <Modal isOpen={isOpen} onClose={onClose}>
    <ModalOverlay />
    <ModalContent>
      <ModalHeader>Renew domain</ModalHeader>
      <ModalCloseButton />
      <ModalBody>
        <Text mb={4}>Renew a domain for 1 to 12 months</Text>
        <NumberInput step={1} defaultValue={12} min={1} max={12} value={durationInput} onChange={(t) => { setDurationInput(Number(t) || 0) }}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <Text mt={4}>Estimated Cost: {Number(ethers.utils.formatEther(cost)).toFixed(4)} ONE</Text>
      </ModalBody>
      <ModalFooter>
        <Button onClick={renew}>Renew</Button>
      </ModalFooter>
    </ModalContent>
  </Modal>
}

export default ModalRenew
