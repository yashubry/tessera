'use client'
import { useEffect, useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import axios from 'axios'
import {
  Box,
  Button,
  Checkbox,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputRightElement,
  Link,
  Stack,
  Text,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react'
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons'

const API_BASE = 'http://localhost:5000'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  // If already logged in, bounce to events
  useEffect(() => {
    const t = localStorage.getItem('access_token')
    if (t) navigate('/events')
  }, [navigate])

  const submit = async () => {
    if (!username || !password) {
      toast({
        title: 'Missing info',
        description: 'Please enter both username and password.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    setLoading(true)
    try {
      const res = await axios.post(`${API_BASE}/login`, { username, password })
      const token = res.data?.access_token
      if (!token) throw new Error('No token returned')

      localStorage.setItem('access_token', token)

      toast({
        title: 'Welcome back!',
        status: 'success',
        duration: 1500,
        isClosable: true,
      })
      navigate('/events')
    } catch (err) {
      const msg =
        err?.response?.status === 401
          ? 'Invalid username or password.'
          : 'Something went wrong. Please try again.'
      toast({ title: 'Login failed', description: msg, status: 'error', duration: 3500, isClosable: true })
    } finally {
      setLoading(false)
    }
  }

  const bgCard = useColorModeValue('white', 'gray.800')
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.200')

  return (
    <Flex minH="100vh" align="stretch">
      {/* Left: form */}
      <Container maxW="lg" py={{ base: 10, md: 16 }} flex="1">
        <Stack spacing={8}>
          <Stack spacing={1}>
            <Heading size="2xl" lineHeight="shorter">
              sign in
            </Heading>
            <Text color="gray.500">Welcome back—grab your seats.</Text>
          </Stack>

          <Box bg={bgCard} border="1px solid" borderColor={border} rounded="2xl" p={6} shadow="md">
            <Stack spacing={5}>
              <FormControl id="username" isRequired>
                <FormLabel>Username</FormLabel>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              </FormControl>

              <FormControl id="password" isRequired>
                <FormLabel>Password</FormLabel>
                <InputGroup>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                  />
                  <InputRightElement>
                    <IconButton
                      variant="ghost"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                      size="sm"
                      onClick={() => setShowPassword((v) => !v)}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              <HStack justify="space-between">
                <Checkbox defaultChecked>Remember me</Checkbox>
                <Link as={RouterLink} to="#" color="teal.400">
                  Forgot password?
                </Link>
              </HStack>

              <Button colorScheme="teal" onClick={submit} isLoading={loading}>
                Sign in
              </Button>

              <Text textAlign="center" color="gray.500">
                New here?{' '}
                <Link as={RouterLink} to="/register" color="teal.400" fontWeight="bold">
                  Create an account
                </Link>
              </Text>
            </Stack>
          </Box>
        </Stack>
      </Container>

      {/* Right: image */}
      <Box flex="1" display={{ base: 'none', md: 'block' }}>
        <Image
          alt="Concert crowd"
          src="https://i.imgur.com/taseBi0.jpeg"
          objectFit="cover"
          h="100%"
          w="100%"
        />
      </Box>
    </Flex>
  )
}