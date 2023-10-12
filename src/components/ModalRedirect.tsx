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
  ModalOverlay, Text,
  useToast
} from '@chakra-ui/react'
import { signMessage } from '@wagmi/core'
import { REGISTRAR_RELAY_BASE_API, tld } from '~/config'
import React from 'react'
import axios from 'axios'

const base = axios.create({ timeout: 15000 })

const ModalRedirect = ({ domain, control }: { domain: string, control: UseDisclosureReturn }): JSX.Element => {
  const { isOpen, onClose } = control
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm()
  const toast = useToast()
  const onSubmit = async (data: any): Promise<void> => {
    const deadline = Math.floor(Date.now() / 1000) + 600
    const target = data.target as string
    const subdomain = data.subdomain as string
    const path = data.path as string
    const fqdn = subdomain === '@' ? `${domain}.${tld}` : `${subdomain}.${domain}.${tld}`
    // const fullUrl = path === '/' ? fqdn : `${fqdn}${path}`
    const fullUrl = `${fqdn}${path}`
    const signature = await signMessage({ message: `I want to map ${fullUrl} to ${target}. This operation has to complete by timestamp ${deadline}` })
    console.log(signature)
    try {
      const { data: { success } } = await base.post(`${REGISTRAR_RELAY_BASE_API}/redirect`, {
        deadline,
        subdomain,
        path,
        target,
        signature,
        domain: `${domain}.${tld}`
      })
      if (success) {
        toast({ status: 'success', description: `Successfully mapped ${subdomain}.${domain}.${tld} to ${target}` })
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
      <ModalHeader>Redirect to URL (HTTP 301)</ModalHeader>
      <ModalCloseButton />
      <ModalBody>
        <Text>Use @ for root domain (i.e. to redirect <b>{domain}.{tld}</b> itself)</Text>
        <FormControl isInvalid={!!errors.subdomain}>
          <FormLabel>Subdomain</FormLabel>
          <Input autoFocus
                 {...register('subdomain', {
                   required: true,
                   validate: { validSubdomain: (value) => /^(@|[a-z0-9-]+)$/.test(value) }
                 })}
          />
          <Text>Use / for root path. Must not contain query string (?) or hash location (#)</Text>
          <Input autoFocus
                 placeholder={'/path'}
                 {...register('path', {
                   required: true,
                   validate: {
                     validPath: (value: string) => {
                       if (value.includes('?') || value.includes('#')) {
                         return false
                       }
                       try {
                       // eslint-disable-next-line no-new
                         new URL(`https://${domain}${value}`)
                         return true
                       } catch (ex: any) {
                         console.error(ex)
                         return false
                       }
                     }
                   }
                 })}
          />
          <FormLabel>Target URL</FormLabel>
          <Input autoFocus
                placeholder={'https://twitter.com/harmonyprotocol'}
                {...register('target', {
                  required: true,
                  validate: {
                    validHost: (value: string) => {
                      try {
                        // eslint-disable-next-line no-new
                        new URL(value)
                        return true
                      } catch (ex: any) {
                        console.error(ex)
                        return false
                      }
                    }
                  }
                })}
            />
          {errors.subdomain && <FormErrorMessage>
            {errors.subdomain.type === 'required' ? 'Required' : errors.subdomain.type === 'validSubdomain' && 'Invalid subdomain'}
            </FormErrorMessage>}
          {errors.path && <FormErrorMessage>
            {errors.path.type === 'required' ? 'Required' : errors.path.type === 'validPath' && 'Invalid path'}
          </FormErrorMessage>}
          {errors.host && <FormErrorMessage>
            {errors.host.type === 'required' ? 'Required' : errors.host.type === 'validTarget' && 'Invalid target'}
            </FormErrorMessage>}
        </FormControl>
      </ModalBody>
      <ModalFooter>
        <Button type="submit">Save</Button>
      </ModalFooter>
    </ModalContent>
  </Modal>
}

export default ModalRedirect
