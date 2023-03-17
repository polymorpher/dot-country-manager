import { getContract } from '@wagmi/core'
import * as CONFIG from '~/config'
import erc721ABI from '~/abis/erc721ABI.json'
import erc1155ABI from '~/abis/erc1155ABI.json'

export const nameWrapper = getContract({
  address: CONFIG.nameWrapperAddress,
  abi: erc1155ABI
})

export const baseRegistrar = getContract({
  address: CONFIG.baseRegistrarAddress,
  abi: erc721ABI
})
