import { Abi } from 'abitype'

declare module '@ensdomains/eth-ens-namehash';

type Meta = {
  name: string
  description: string
  image: string
  attributes: {
    trait_type: string
    display_type: "number" | "date"
    value: string
  }[]
}

type ContractConfig = {
  address: `0x${string}`
  abi: Abi
}
