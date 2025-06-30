import React from 'react';
import { Box, Flex, Text, Button, Spacer, HStack } from '@chakra-ui/react';
import { SiAseprite } from "react-icons/si";
import { ColorModeButton } from "./ui/color-mode"; // Dark mode toggle


function Navbar() {
  return (
    <Flex bg="cyan.900" color="white" p="4" alignItems="center">
      <Box p="2">
        <Text fontSize="xl" fontWeight="bold">Tessera Events</Text>
      </Box>
      <Box>
        <Text fontSize="xl" fontWeight="bold">
          Tessera Events
        </Text>
      </Box>

      <Spacer />

      <HStack spacing={4}>
        <Button
          variant="outline"
          colorScheme="whiteAlpha"
          leftIcon={<SiAseprite />}
        >
          Profile
        </Button>
        // <ColorModeButton /> 
      </HStack>
    </Flex>
  );
}


export default Navbar;