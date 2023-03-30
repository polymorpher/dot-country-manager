import React from 'react'
import {
  Card,
  CardBody,
  Heading,
  Image,
  SimpleGrid,
  Text,
  VStack
} from '@chakra-ui/react'
import { type Meta, type MetaAttribute } from '~/types'

interface DomainProps {
  meta: Meta
}

const processAttribute = (attribute: MetaAttribute): string => {
  if (attribute.display_type === 'date') {
    return new Date(Number(attribute.value)).toLocaleDateString()
  }
  return attribute.value.toString()
}
const Domain: React.FC<DomainProps> = ({ meta }) => (
  <Card overflow="hidden" align={'center'} border={'none'} shadow={'none'} p={4}>
    <Image src={meta.image} maxW={320} alt="image" />
    <CardBody>
      <VStack mt="2">
        <Heading size="md">{meta.name}</Heading>
        <Text p={4}>{meta.description}</Text>
        <SimpleGrid py={4} spacingX={8} columns={2} spacing={2}>
          {meta.attributes.map((attr, key) => (
            <React.Fragment key={key}>
              <Text textAlign="left">{attr.trait_type}:</Text>
              <Text textAlign="right">{processAttribute(attr)}</Text>
            </React.Fragment>
          ))}
        </SimpleGrid>
      </VStack>
    </CardBody>
  </Card>
)

export default Domain
