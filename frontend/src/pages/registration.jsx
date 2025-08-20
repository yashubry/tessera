'use client'
import { useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
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

export default function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const validate = () => {
    if (!username || !email || !password) {
      toast({ title: 'Missing info', description: 'Fill out all fields.', status: 'warning', duration: 3000, isClosable: true })
      return false
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast({ title: 'Invalid email', status: 'warning', duration: 3000, isClosable: true })
      return false
    }
    if (password.length < 6) {
      toast({ title: 'Weak password', description: 'Use at least 6 characters.', status: 'warning', duration: 3000, isClosable: true })
      return false
    }
    return true
  }

  const submit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg =
          res.status === 409 ? 'Username or email already exists.' : data?.error || 'Registration failed.'
        throw new Error(msg)
      }

      toast({ title: 'Account created!', description: 'You can now sign in.', status: 'success', duration: 2500, isClosable: true })
      navigate('/login')
    } catch (err) {
      toast({ title: 'Could not create account', description: err.message, status: 'error', duration: 3500, isClosable: true })
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
            <Heading size="2xl">create account</Heading>
            <Text color="gray.500">Join Tessera and never miss a seat.</Text>
          </Stack>

          <Box bg={bgCard} border="1px solid" borderColor={border} rounded="2xl" p={6} shadow="md">
            <Stack spacing={5}>
              <FormControl id="username" isRequired>
                <FormLabel>Username</FormLabel>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </FormControl>

              <FormControl id="email" isRequired>
                <FormLabel>Email</FormLabel>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
              </FormControl>

              <FormControl id="password" isRequired>
                <FormLabel>Password</FormLabel>
                <InputGroup>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
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
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Use at least 6 characters.
                </Text>
              </FormControl>

              <Button colorScheme="teal" onClick={submit} isLoading={loading}>
                Create account
              </Button>

              <HStack justify="center">
                <Text color="gray.500">Already have an account?</Text>
                <Link as={RouterLink} to="/login" color="teal.400" fontWeight="bold">
                  Sign in
                </Link>
              </HStack>
            </Stack>
          </Box>
        </Stack>
      </Container>

      {/* Right: image */}
      <Box flex="1" display={{ base: 'none', md: 'block' }}>
        <Image
          alt="Signup"
          src="https://i.imgur.com/JWlAzXW.jpeg"
          objectFit="cover"
          h="100%"
          w="100%"
        />
      </Box>
    </Flex>
  )
}