import * as ethers from "ethers"
import namehash from "@ensdomains/eth-ens-namehash"
import * as CONFIG from "~/config"

export const getUnwrappedTokenId = (sld: string) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(sld))

export const getWrappedTokenId = (sld: string) => namehash.hash(`${sld}.${CONFIG.tld}`)
