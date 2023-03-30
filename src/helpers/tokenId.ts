import * as ethers from 'ethers'
import * as CONFIG from '~/config'

export const getUnwrappedTokenId = (sld: string): string => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(sld))

export const getWrappedTokenId = (sld: string): string => ethers.utils.namehash(`${sld}.${CONFIG.tld}`)
