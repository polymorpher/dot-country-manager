import { Card, CardBody, Heading, HStack, Image, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import React from 'react'

interface DomainProps {
  meta: Meta
}

const Domain: React.FC<DomainProps> = ({ meta }) => (
  <Card>
    <CardBody>
      <Image src={meta.image} alt='image' borderRadius='lg' />
      <VStack mt="2">
        <Heading size="md">{meta.name}</Heading>
        <Text>{meta.description}</Text>
        <SimpleGrid columns={2} spacing={2}>
          {meta.attributes.map((attr, key) => (
            <React.Fragment key={key}>
              <Text textAlign="right">{attr.trait_type}</Text>
              <Text>{attr.value}</Text>
            </React.Fragment>
          ))}
        </SimpleGrid>
      </VStack>
    </CardBody>
  </Card>
)

export default Domain
