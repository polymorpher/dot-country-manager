import { Abi } from 'abitype'
import erc721ABI from '~/abis/erc721ABI.json'
import NameWrapper from '~/abis/NameWrapper.json'
import { ContractConfig } from './types'

export const nameWrapperContract: ContractConfig = {
  address: "0x69e756D56762Fc66ADE2eA8Da4cEd4F888d0cf8A",
  abi: NameWrapper as Abi
}

export const baseRegistrarContract: ContractConfig = {
  address: "0x91cA002f8217b939a4f24EeCB992e07dCDecA32c",
  abi: erc721ABI as Abi
}

export const resolverContract: ContractConfig = {
  address: '0xb3033Ec63c6fCc3A24a3D74C1E9d88CeaBE9c4c6',
  abi: [] as Abi
}

export const tld = "country"
