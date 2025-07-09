import React from 'react';
import { Box, Flex, Text, Button, Spacer, HStack } from '@chakra-ui/react';
import { SiAseprite } from "react-icons/si";
import { ColorModeButton } from "./ui/color-mode"; // Dark mode toggle
import { useNavigate } from 'react-router-dom';  // <-- you forgot this import!
import { MdHomeFilled } from "react-icons/md";
import { LuPartyPopper } from "react-icons/lu";


function Navbar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login'); // Redirect to login page
  };

  return (
    <Flex bg="cyan.900" color="white" p="4" alignItems="center" fontStyle="italic">
      <Box p="2">
        <Text fontSize="5xl" fontWeight="black">TESSERA</Text>
      </Box>

      <Spacer />

      <HStack spacing={4}>
        

        <Button
          variant="outline"
          colorScheme="white"
          leftIcon={<MdHomeFilled />}
          fontStyle="italic"
          onClick={() => navigate('/l')}  
        >
          <Text color="cyan.200" fontSize="xl" fontWeight="black">home</Text>
        </Button>

        <Button
          variant="outline"
          colorScheme="white"
          fontStyle="italic"
          onClick={() => navigate('/events')}  
          leftIcon={<LuPartyPopper />}
        >
          <Text color="cyan.200" fontSize="xl" fontWeight="black">events</Text>
        </Button>

        <Button
          variant="outline"
          colorScheme="white"
          leftIcon={<SiAseprite />}
          fontStyle="italic"
          onClick={() => navigate('/user/profile')}  // example: navigate to profile
        >
          <Text color="cyan.200" fontSize="xl" fontWeight="black">profile</Text>
        </Button>

        <Button
          colorScheme="white"
          color="cyan.100"
          fontStyle="italic"
          onClick={() => navigate('/login')}  
        >
          <Text color="cyan.100" fontSize="xl" fontWeight="black">log in</Text>
        </Button>

        <Button
          colorScheme="white"
          color="cyan.100"
          fontStyle="italic"
          onClick={handleLogout}                // logout button here
        > 
          <Text color="cyan.100" fontSize="xl" fontWeight="black">log out</Text>
        </Button>

        <ColorModeButton />
      </HStack>
    </Flex>
  );
}

export default Navbar;
