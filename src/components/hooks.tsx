import { useToast } from '@chakra-ui/react'
import { useCallback } from 'react'
import { REGISTRAR_RELAY_BASE_API, tld } from '~/config'
import axios from 'axios'

interface UseDnsControlReturn {
  activateSubdomains: () => Promise<void>
  activateMail: () => Promise<void>
}

const base = axios.create({ timeout: 15000 })
export const useDnsControl = ({ domain }: { domain: string }): UseDnsControlReturn => {
  const toast = useToast()
  const activateSubdomains = useCallback(async () => {
    try {
      const { data: { success } } = await base.post(`${REGISTRAR_RELAY_BASE_API}/enable-subdomains`, { domain: `${domain}.${tld}` })
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
      const { data: { success } } = await base.post(`${REGISTRAR_RELAY_BASE_API}/enable-mail`, { domain: `${domain}.${tld}` })
      if (success) {
        toast({ status: 'success', description: `Successfully activated Email Alias Service at mail.${domain}.${tld}` })
      }
    } catch (ex: any) {
      console.error(ex)
      const error = ex?.response?.data?.error || ex.toString()
      toast({ status: 'error', description: `Failed to activate Email Alias Service. Error: ${error}` })
    }
  }, [domain, toast])
  return { activateSubdomains, activateMail }
}
