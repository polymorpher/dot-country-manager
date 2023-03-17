import namehash from "@ensdomains/eth-ens-namehash"
import * as ethers from "ethers"
import * as CONFIG from "~/config"

export const getUnwrappedTokenId = (sld: string) => ethers.BigNumber.from(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(sld)))

export const getWrappedTokenId = (sld: string) => ethers.BigNumber.from(namehash.hash(`${sld}.${CONFIG.tld}`))
