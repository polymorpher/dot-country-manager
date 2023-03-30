import { type Abi } from 'abitype'

interface MetaAttribute {
  display_type: string
  trait_type: string
  value: string | number
}

interface Meta {
  name: string
  description: string
  image: string
  attributes: MetaAttribute[]
}

interface ContractConfig {
  address: `0x${string}`
  abi: Abi
}
