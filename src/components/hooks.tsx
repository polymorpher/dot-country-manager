import { useToast } from '@chakra-ui/react'
import { useCallback } from 'react'
import { REGISTRAR_RELAY_BASE_API, tld } from '~/config'
import axios from 'axios'

interface UseDnsControlReturn {
  activateSubdomains: () => Promise<void>
  activateMail: () => Promise<void>
  genMetadata: () => Promise<void>
  renewMetadata: () => Promise<void>
  genCert: () => Promise<void>
  renewCert: () => Promise<void>
  certJobLookup: (jobId: string) => Promise<{ isCompleted: boolean, isSuccess: boolean, error: string }>

}

const sleep = async (t: number): Promise<void> => { await new Promise((resolve) => setTimeout(resolve, t)) }
const base = axios.create({ timeout: 15000 })
export const useDnsControl = ({ domain }: { domain: string }): UseDnsControlReturn => {
  const toast = useToast()
  const activateSubdomains = useCallback(async () => {
    try {
      const { data: { success } } = await base.post(`${REGISTRAR_RELAY_BASE_API}/dns/enable-subdomains`, { domain: `${domain}.${tld}` })
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
      const { data: { success } } = await base.post(`${REGISTRAR_RELAY_BASE_API}/dns/enable-mail`, { domain: `${domain}.${tld}` })
      if (success) {
        toast({ status: 'success', description: `Successfully activated Email Alias Service at mail.${domain}.${tld}` })
      }
    } catch (ex: any) {
      console.error(ex)
      const error = ex?.response?.data?.error || ex.toString()
      toast({ status: 'error', description: `Failed to activate Email Alias Service. Error: ${error}` })
    }
  }, [domain, toast])

  const genMetadata = useCallback(async () => {
    try {
      const { data: { generated, error } } = await base.post(`${REGISTRAR_RELAY_BASE_API}/gen`, { domain: `${domain}.${tld}` })
      if (generated) {
        toast({ status: 'success', description: `Successfully generated metadata. Please try the lookup again (${domain}.${tld})` })
      } else {
        toast({ status: 'error', description: `Failed to generate metadata (${domain}.${tld}). Error: ${error}` })
      }
    } catch (ex: any) {
      console.error(ex)
      const error = ex?.response?.data?.error || ex.toString()
      toast({ status: 'error', description: `Exception during generating metadata (${domain}.${tld}). Error: ${error}` })
    }
  }, [domain, toast])
  const renewMetadata = useCallback(async () => {
    try {
      const { data: { renewed, error } } = await base.post(`${REGISTRAR_RELAY_BASE_API}/renew-metadata`, { domain: `${domain}.${tld}` })
      if (renewed) {
        toast({ status: 'success', description: `Successfully renewed metadata. Please try the lookup again (${domain}.${tld})` })
      } else {
        toast({ status: 'error', description: `Failed to renew metadata (${domain}.${tld}). Error: ${error}` })
      }
    } catch (ex: any) {
      console.error(ex)
      const error = ex?.response?.data?.error || ex.toString()
      toast({ status: 'error', description: `Exception during renewing metadata (${domain}.${tld}). Error: ${error}` })
    }
  }, [domain, toast])

  const certJobLookup = useCallback(async (jobId: string): Promise<{ isCompleted: boolean, isSuccess: boolean, error: string }> => {
    let isCompleted = false
    let isSuccess = false
    let terminate = false
    let err = ''

    while (!terminate) {
      try {
        const {
          data: {
            completed,
            success,
            error
          }
        } = await base.post(`${REGISTRAR_RELAY_BASE_API}/cert-job-lookup`, { domain: `${domain}.${tld}`, async: true })
        if (completed || error || success) {
          terminate = true
        }
        isCompleted = completed
        isSuccess = success
        err = error
        await sleep(1500)
      } catch (ex: any) {
        console.error(ex)
        const error = ex?.response?.data?.error || ex.toString()
        toast({ status: 'error', description: `Exception during certificate request lookup (${domain}.${tld}). Error: ${error}` })
        err = error
        terminate = true
      }
    }
    return { isCompleted, isSuccess, error: err }
  }, [domain, toast])

  const genCert = useCallback(async () => {
    try {
      const { data: { success, wcJobId: wcJob, nakedJobId: nakedJob, error } } = await base.post(`${REGISTRAR_RELAY_BASE_API}/cert`, { domain: `${domain}.${tld}`, async: true })
      if (success) {
        const { wcJobId } = wcJob
        const { nakedJobId } = nakedJob
        toast({ status: 'success', description: `Successfully requested for SSL certificate (${domain}.${tld}). Waiting for completion...` })
        certJobLookup(wcJobId).then(({ isSuccess, error }) => {
          if (isSuccess) {
            toast({ status: 'success', description: `Wildcard certificate (*.${domain}.${tld}) provision completed` })
          } else {
            toast({ status: 'error', description: `Wildcard certificate (*.${domain}.${tld}) provision failed. Error :${error}` })
          }
        }).catch(ex => {
          console.error(ex)
        })
        certJobLookup(nakedJobId).then(({ isSuccess, error }) => {
          if (isSuccess) {
            toast({ status: 'success', description: `Naked domain certificate (${domain}.${tld}) provision completed` })
          } else {
            toast({ status: 'error', description: `Naked domain certificate (*.${domain}.${tld}) provision failed. Error :${error}` })
          }
        }).catch(ex => {
          console.error(ex)
        })
      } else {
        toast({ status: 'error', description: `Failed to request for SSL certificate (${domain}.${tld}). Error: ${error}` })
      }
    } catch (ex: any) {
      console.error(ex)
      const error = ex?.response?.data?.error || ex.toString()
      toast({ status: 'error', description: `Exception during generating metadata (${domain}.${tld}). Error: ${error}` })
    }
  }, [certJobLookup, domain, toast])

  const renewCert = useCallback(async () => {
    try {
      const { data: { success, wcJobId: wcJob, nakedJobId: nakedJob, error } } = await base.post(`${REGISTRAR_RELAY_BASE_API}/renew-cert`, { domain: `${domain}.${tld}`, async: true })
      if (success) {
        toast({ status: 'success', description: `Successfully requested for renewal of SSL certificate (${domain}.${tld}). Waiting for completion...` })
        const { wcJobId } = wcJob
        const { nakedJobId } = nakedJob
        toast({ status: 'success', description: `Successfully requested for SSL certificate (${domain}.${tld}). Waiting for completion...` })
        certJobLookup(wcJobId).then(({ isSuccess, error }) => {
          if (isSuccess) {
            toast({ status: 'success', description: `Wildcard certificate (*.${domain}.${tld}) provision completed` })
          } else {
            toast({ status: 'error', description: `Wildcard certificate (*.${domain}.${tld}) provision failed. Error :${error}` })
          }
        }).catch(ex => {
          console.error(ex)
        })
        certJobLookup(nakedJobId).then(({ isSuccess, error }) => {
          if (isSuccess) {
            toast({ status: 'success', description: `Naked domain certificate (${domain}.${tld}) provision completed` })
          } else {
            toast({ status: 'error', description: `Naked domain certificate (*.${domain}.${tld}) provision failed. Error :${error}` })
          }
        }).catch(ex => {
          console.error(ex)
        })
      } else {
        toast({ status: 'error', description: `Failed to renew metadata (${domain}.${tld}). Error: ${error}` })
      }
    } catch (ex: any) {
      console.error(ex)
      const error = ex?.response?.data?.error || ex.toString()
      toast({ status: 'error', description: `Exception during renewing metadata (${domain}.${tld}). Error: ${error}` })
    }
  }, [certJobLookup, domain, toast])

  return { activateSubdomains, activateMail, genMetadata, renewMetadata, genCert, renewCert, certJobLookup }
}
