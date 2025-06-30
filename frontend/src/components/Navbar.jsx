import React from 'react';
import { Box, Flex, Text, Button, Spacer, HStack } from '@chakra-ui/react';
import { SiAseprite } from "react-icons/si";
import { ColorModeButton } from "./ui/color-mode"; // Dark mode toggle


function Navbar() {
  return (
    <Flex bg="cyan.900" color="white" p="4" alignItems="center" fontStyle="italic">
      <Box p="2">
        <Text fontSize="3xl" fontWeight="black">TESSERA EVENTS</Text>
      </Box>

      <Spacer />

      <HStack spacing={4}>
        <Button
          variant="outline"
          colorScheme="white"
          leftIcon={<SiAseprite />}
          fontStyle="italic"
        >
          profile
        </Button>
         <ColorModeButton /> 
         varient= "outline"
      </HStack>
    </Flex>
  );
}


export default Navbar;