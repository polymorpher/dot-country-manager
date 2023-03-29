import { Abi } from 'abitype'

interface MetaAttribute {
  display_type: string
  trait_type: string
  value: string | number
}

type Meta = {
  name: string
  description: string
  image: string
  attributes: MetaAttribute[]
}

type ContractConfig = {
  address: `0x${string}`
  abi: Abi
}
