import { type UseDisclosureReturn } from '@chakra-ui/hooks/dist/use-disclosure'
import { useForm } from 'react-hook-form'
import {
  Button,
  FormControl, FormErrorMessage, FormLabel, NumberInput,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent, ModalFooter,
  ModalHeader,
  ModalOverlay, Text,
  useToast
} from '@chakra-ui/react'
import { signMessage, readContract, prepareWriteContract, writeContract } from '@wagmi/core'
import { REGISTRAR_RELAY_BASE_API, tld } from '~/config'
import React, { useState } from 'react'
import axios from 'axios'
import { useAccount, useNetwork } from 'wagmi'
const base = axios.create({ timeout: 15000 })

const ModalRenew = ({ domain, control }: { domain: string, control: UseDisclosureReturn }): JSX.Element => {
  const { address, isConnected } = useAccount()
  const { chain } = useNetwork()
  const [durationInput, setDurationInput] = useState<number>(1)

  const { isOpen, onClose } = control

  const toast = useToast()
  const renew = async (data: any): Promise<void> => {
    try {
      // TODO
      if (success) {
        toast({ status: 'success', description: `Successfully renewed ${domain}.${tld} for ${durationInput} months` })
      }
      onClose()
    } catch (ex: any) {
      console.error(ex)
      const error = ex?.response?.data?.error || ex.toString()
      toast({ status: 'error', description: `Failed to renew domain. Error: ${error}` })
    }
  }

  return <Modal isOpen={isOpen} onClose={onClose}>
    <ModalOverlay />
    <ModalContent>
      <ModalHeader>Renew domain</ModalHeader>
      <ModalCloseButton />
      <ModalBody>
        <Text>Renew a domain for 1 to 12 months</Text>
        <NumberInput value={durationInput} onChange={(t) => { setDurationInput(Number(t) || 0) }}/>
      </ModalBody>
      <ModalFooter>
        <Button onClick={renew}>Renew</Button>
      </ModalFooter>
    </ModalContent>
  </Modal>
}

export default ModalRenew
