'use client'

import React, { useState, useEffect } from 'react'
import {
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  useColorModeValue,
  HStack,
  Avatar,
  AvatarBadge,
  IconButton,
  Center,
  Spinner,
  Text,
  useToast,
} from '@chakra-ui/react'
import { SmallCloseIcon } from '@chakra-ui/icons'

export default function UserProfileEdit() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(
    'https://previews.123rf.com/images/diter/diter1803/diter180300062/97587698-smiling-rockstar-in-white-vintage-costume-in-studio.jpg'
  )
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

 useEffect(() => {
  const token = localStorage.getItem('token')
  console.log('TOKEN IN PROFILE EFFECT:', token)

  if (!token) {
    console.log('❌ No token found')
    setError('You must be logged in.')
    setLoading(false)
    return
  }

  console.log('✅ Making fetch call with token...')

  fetch('http://localhost:5000/user/profile', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    mode: 'cors',
  })
    .then(async (res) => {
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to fetch profile')
      }
      return res.json()
    })
    .then(data => {
      console.log('✅ Fetched profile data:', data)
      setUsername(data.username || '')
      setEmail(data.email || '')
      // if you have profile pic URL from backend, set it here:
      if (data.profile_pic_url) {
        setAvatarUrl(data.profile_pic_url)
      }
      setLoading(false)
    })
    .catch(err => {
      console.error('❌ Fetch error:', err)
      setError(err.message)
      setLoading(false)
    })
}, [])


  const handleSubmit = () => {
    setSubmitting(true)
    setError('')
    const token = localStorage.getItem('token')
    if (!token) {
      setError('You must be logged in to update your profile.')
      setSubmitting(false)
      return
    }

    fetch('http://localhost:5000/user/profile', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        email,
        password: password || undefined, // optional
        profile_pic_url: avatarUrl,
      }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update profile')
        }
        toast({
          title: 'Profile updated.',
          description: 'Your profile was successfully updated.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
        setPassword('')
      })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handleAvatarRemove = () => {
    setAvatarUrl('')
  }

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <Spinner size="xl" />
      </Flex>
    )
  }

  if (error) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg={useColorModeValue('gray.50', 'gray.800')}>
        <Text color="red.500" fontSize="lg">
          {error}
        </Text>
      </Flex>
    )
  }

  return (
    <Flex minH={'100vh'} align={'center'} justify={'center'} bg={useColorModeValue('gray.50', 'gray.800')}>
      <Stack
        spacing={4}
        w={'full'}
        maxW={'md'}
        bg={useColorModeValue('white', 'gray.700')}
        rounded={'xl'}
        boxShadow={'lg'}
        p={6}
        my={12}>
        <Heading lineHeight={1.1} fontSize={{ base: '2xl', sm: '3xl' }}>
          User Profile Edit
        </Heading>

        <FormControl id="userIcon" mb={4}>
          <FormLabel>User Icon</FormLabel>
          <Stack direction={['column', 'row']} spacing={6}>
            <Center>
              <Avatar size="xl" src={avatarUrl}>
                {avatarUrl && (
                  <AvatarBadge
                    as={IconButton}
                    size="sm"
                    rounded="full"
                    top="-10px"
                    colorScheme="red"
                    aria-label="remove Image"
                    icon={<SmallCloseIcon />}
                    onClick={handleAvatarRemove}
                  />
                )}
              </Avatar>
            </Center>
            <Center w="full">
              {/* For now, just allow pasting a URL */}
              <Input
                placeholder="Image URL"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </Center>
          </Stack>
        </FormControl>

        <FormControl id="username" isRequired>
          <FormLabel>User name</FormLabel>
          <Input
            placeholder="UserName"
            _placeholder={{ color: 'gray.500' }}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </FormControl>

        <FormControl id="email" isRequired>
          <FormLabel>Email address</FormLabel>
          <Input
            placeholder="your-email@example.com"
            _placeholder={{ color: 'gray.500' }}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormControl>

        <FormControl id="password">
          <FormLabel>Password (leave blank to keep current)</FormLabel>
          <Input
            placeholder="New password"
            _placeholder={{ color: 'gray.500' }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormControl>

        <Stack spacing={6} direction={['column', 'row']}>
          <Button
            bg={'red.400'}
            color={'white'}
            w="full"
            _hover={{
              bg: 'red.500',
            }}
            onClick={() => {
              // Reset form or redirect - here just reload page
              window.location.reload()
            }}>
            Cancel
          </Button>
          <Button
            bg={'blue.400'}
            color={'white'}
            w="full"
            isLoading={submitting}
            _hover={{
              bg: 'blue.500',
            }}
            onClick={handleSubmit}>
            Submit
          </Button>
        </Stack>
      </Stack>
    </Flex>
  )
}
