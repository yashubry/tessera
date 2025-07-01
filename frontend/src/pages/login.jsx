'use client'

import {
  Button,
  Checkbox,
  Flex,
  Text,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Image,
} from '@chakra-ui/react'

export default function SplitScreen() {
  return (
    <Stack minH={'100vh'} direction={{ base: 'column', md: 'row' }}>
      <Flex p={8} flex={1} align={'center'} justify={'center'}>
        <Stack spacing={4} w={'full'} maxW={'md'}>
          <Heading fontSize={'8xl'}>tune in!</Heading>
          <FormControl id="email">
            <FormLabel>email</FormLabel>
            <Input type="email" />
          </FormControl>
          <FormControl id="username">
            <FormLabel>username</FormLabel>
            <Input type="username" />
          </FormControl>
          <FormControl id="password">
            <FormLabel>password</FormLabel>
            <Input type="password" />
          </FormControl>
          <Stack spacing={6}>
            <Stack
              direction={{ base: 'column', sm: 'row' }}
              align={'start'}
              justify={'space-between'}>
              {/*<Checkbox>Remember me</Checkbox>
              <Text color={'blue.500'}>Forgot password?</Text> */} {/*uncomment when you have a plan for these!*/}
            </Stack>
            <Button colorScheme={'blue'} variant={'solid'}>
              sign in
            </Button>
          </Stack>
        </Stack>
      </Flex>
      <Flex flex={1}>
        <Image
          alt={'Login Image'}
          objectFit={'cover'}
          src={
            'https://i.imgur.com/taseBi0.jpeg'
          }
        />
      </Flex>
    </Stack>
  )
}