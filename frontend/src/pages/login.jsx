'use client'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  Button,
  Flex,
  Text,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Image,
  LinkBox,
} from '@chakra-ui/react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async () => {
    setError('')
    setLoading(true)

    if (!username || !password) {
      setError('Username and password are required.')
      setLoading(false)
      return
    }

    try {
      const res = await axios.post('http://localhost:5000/login', {
        username,
        password,
      })

      const token = res.data.access_token
      localStorage.setItem('token', token)

      navigate('/events') // change to your desired route
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid username or password.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <LinkBox as="article" w="full"  overflow="hidden" boxShadow="md">
    <Stack minH="100vh" direction={{ base: 'column', md: 'row' }}>
      <Flex p={8} flex={1} align="center" justify="center">
        <Stack spacing={4} w="full" maxW="md">
          <Heading fontSize="5xl">Sign in</Heading>
          {error && (
            <Text color="red.500" fontWeight="medium">
              {error}
            </Text>
          )}

          <FormControl id="username" isRequired>
            <FormLabel>Username</FormLabel>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </FormControl>

          <FormControl id="password" isRequired>
            <FormLabel>Password</FormLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </FormControl>

          <Button
            colorScheme="blue"
            variant="solid"
            onClick={handleLogin}
            isLoading={loading}
          >
            Sign In
          </Button>
        </Stack>
      </Flex>

      <Flex flex={1}>
        <Image
          alt="Login Image"
          objectFit="cover"
          src="https://i.imgur.com/taseBi0.jpeg"
        />
      </Flex>
    </Stack>
    </LinkBox>
  )
}
