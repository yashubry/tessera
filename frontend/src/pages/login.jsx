'use client'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

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

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const navigate = useNavigate()

    const handleLogin = async () => {
    setError('')

    if (!username || !password) {
        setError('Username and password are required.');
        return;
    }

    try {
        const res = await axios.post('http://localhost:5000/login', {
            username, 
            password
    })

    const token = res.data.access_token
    localStorage.setItem('token', token)
    navigate('/')
    } catch (err) {
    if (err.response?.status === 401) {
        setError('Invalid username or password.')
    } else {
        setError('Something went wrong. Please try again.')
    }
    }
  }

  return (
    <Stack minH={'100vh'} direction={{ base: 'column', md: 'row' }}>
      <Flex p={8} flex={1} align={'center'} justify={'center'}>
        <Stack spacing={4} w={'full'} maxW={'md'}>
          <Heading fontSize={'8xl'}>tune in!</Heading>
          {error && (
            <Text color="red.500" fontWeight="bold">
              {error}
            </Text>
          )}

          <FormControl id="username">
            <FormLabel>username</FormLabel>
            <Input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)} 
            />
          </FormControl>
          <FormControl id="password">
            <FormLabel>password</FormLabel>
            <Input 
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)} 
            />
          </FormControl>
          <Stack spacing={6}>
            <Stack
              direction={{ base: 'column', sm: 'row' }}
              align={'start'}
              justify={'space-between'}>
              {/*<Checkbox>Remember me</Checkbox>
              <Text color={'blue.500'}>Forgot password?</Text> */} {/*uncomment when you have a plan for these!*/}
            </Stack>
            <Button colorScheme={'blue'} variant={'solid'} onClick={handleLogin}>
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