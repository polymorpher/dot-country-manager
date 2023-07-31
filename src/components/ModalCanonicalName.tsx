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
import { signMessage } from '@wagmi/core'
import { REGISTRAR_RELAY_BASE_API, tld } from '~/config'
import React from 'react'
import axios from 'axios'

const base = axios.create({ timeout: 15000 })

const ModalCanonicalName = ({ domain, control }: { domain: string, control: UseDisclosureReturn }): JSX.Element => {
  const { isOpen, onClose } = control
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm()
  const toast = useToast()
  const onSubmit = async (data: any): Promise<void> => {
    const deadline = Math.floor(Date.now() / 1000) + 600
    const targetDomain = data.host as string
    const subdomain = data.subdomain as string
    const signature = await signMessage({ message: `I want to map subdomain ${subdomain}.${domain}.${tld} to ${targetDomain}. This operation has to complete by timestamp ${deadline}` })
    console.log(signature)
    try {
      const { data: { success } } = await base.post(`${REGISTRAR_RELAY_BASE_API}/cname`, {
        deadline,
        subdomain,
        targetDomain,
        signature,
        domain: `${domain}.${tld}`
      })
      if (success) {
        toast({ status: 'success', description: `Successfully mapped ${subdomain}.${domain}.${tld} to ${targetDomain}` })
      }
      onClose()
    } catch (ex: any) {
      console.error(ex)
      const error = ex?.response?.data?.error || ex.toString()
      toast({ status: 'error', description: `Failed to map subdomain. Error: ${error}` })
    }
  }

  return <Modal isOpen={isOpen} onClose={onClose}>
    <ModalOverlay />
    <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
      <ModalHeader>Redirect Subdomain (CNAME)</ModalHeader>
      <ModalCloseButton />
      <ModalBody>
        <FormControl isInvalid={!!errors.subdomain}>
          <FormLabel>Subdomain</FormLabel>
          <Input
                        autoFocus
                        {...register('subdomain', {
                          required: true,
                          validate: { validSubdomain: (value) => /^[a-z0-9-]+$/.test(value) }
                        })}
                    />
          <FormLabel>Target Host</FormLabel>
          <Input
                        autoFocus
                        placeholder={'secret-server.harmony.one'}
                        {...register('host', {
                          required: true,
                          validate: { validHost: (value) => /^[a-zA-Z0-9-.]+$/.test(value) }
                        })}
                    />
          {errors.subdomain && <FormErrorMessage>
            {errors.subdomain.type === 'required' ? 'Required' : errors.subdomain.type === 'validSubdomain' && 'Invalid subdomain'}
            </FormErrorMessage>}
          {errors.host && <FormErrorMessage>
            {errors.host.type === 'required' ? 'Required' : errors.host.type === 'validHost' && 'Invalid host'}
            </FormErrorMessage>}
        </FormControl>
      </ModalBody>
      <ModalFooter>
        <Button type="submit">Save</Button>
      </ModalFooter>
    </ModalContent>
  </Modal>
}

export default ModalCanonicalName
