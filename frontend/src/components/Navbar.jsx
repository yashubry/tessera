import React from 'react';
import { Box, Flex, Text, Button, Spacer, HStack } from '@chakra-ui/react';
import { SiAseprite } from "react-icons/si";
import { ColorModeButton } from "./ui/color-mode"; // Dark mode toggle
import { useNavigate } from 'react-router-dom';  // <-- you forgot this import!

function Navbar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login'); // Redirect to login page
  };

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
          onClick={() => navigate('/user/profile')}  // example: navigate to profile
        >
          Profile
        </Button>

        <Button
          variant="outline"
          colorScheme="white"
          onClick={handleLogout}                // logout button here
        >
          Log Out
        </Button>

        <ColorModeButton />
      </HStack>
    </Flex>
  );
}

export default Navbar;
