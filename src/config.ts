import { type Abi } from 'abitype'
import erc721ABI from '~/abis/erc721ABI.json'
import NameWrapper from '~/abis/NameWrapper.json'
import { type ContractConfig } from './types'

export const nameWrapperContract: ContractConfig = {
  address: import.meta.env.VITE_NAME_WRAPPER_ADDRESS,
  abi: NameWrapper as Abi
}

export const baseRegistrarContract: ContractConfig = {
  address: import.meta.env.VITE_BASE_REGISTRAR_ADDRESS,
  abi: erc721ABI as Abi
}

export const resolverContract: ContractConfig = {
  address: import.meta.env.VITE_RESOLVER_ADDRESS,
  abi: [] as Abi
}

export const tld = 'country'

export const rpcProvider = import.meta.env.VITE_PROVIDER

export const walletConnectProjectId = import.meta.env.VITE_WALLET_CONNECT_ID

export const requiredChainId = Number(import.meta.env.VITE_CHAIN_ID)
