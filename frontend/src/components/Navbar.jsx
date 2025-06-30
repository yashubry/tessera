import React from 'react';
import { Box, Flex, Text, Button, Spacer } from '@chakra-ui/react';
import { SiAseprite } from "react-icons/si";

function Navbar() {
  return (
    <Flex bg="cyan.900" color="white" p="4" alignItems="center">
      <Box p="2">
        <Text fontSize="xl" fontWeight="bold">Tessera Events</Text>
      </Box>
      <Spacer />
      <Box>
        <Button colorScheme="white" variant="outline" leftIcon={<SiAseprite />}>
          Profile
        </Button>
      </Box>
    </Flex>
  );
}

export default Navbar;