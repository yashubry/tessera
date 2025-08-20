import React from "react";
import {
  Box,
  Flex,
  HStack,
  Button,
  IconButton,
  Spacer,
  Container,
  Text,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Show,
  Hide,
} from "@chakra-ui/react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { MdHomeFilled } from "react-icons/md";
import { LuPartyPopper } from "react-icons/lu";
import { SiAseprite } from "react-icons/si";
import { FiMenu } from "react-icons/fi";
import { ColorModeButton } from "./ui/color-mode";

function NavLink({ to, icon, children }) {
  const location = useLocation();
  const isActive =
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  const activeBg = useColorModeValue("teal.600", "teal.300");
  const activeColor = useColorModeValue("white", "gray.900");

  return (
    <Button
      as={RouterLink}
      to={to}
      leftIcon={icon}
      variant={isActive ? "solid" : "ghost"}
      colorScheme="teal"
      bg={isActive ? activeBg : "transparent"}
      color={isActive ? activeColor : "inherit"}
      size="sm"
      fontWeight="extrabold"
      _hover={{ bg: isActive ? activeBg : useColorModeValue("blackAlpha.100", "whiteAlpha.200") }}
      _active={{ transform: "translateY(1px)" }}
      rounded="lg"
    >
      {children}
    </Button>
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const bg = useColorModeValue("whiteAlpha.70", "blackAlpha.400");
  const border = useColorModeValue("blackAlpha.100", "whiteAlpha.200");
  const token = localStorage.getItem("access_token") || localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <Box
      position="sticky"
      top={0}
      zIndex="banner"
      bg={bg}
      backdropFilter="saturate(180%) blur(10px)"
      borderBottom="1px solid"
      borderColor={border}
    >
      <Container maxW="7xl">
        <Flex py={3} align="center" gap={3}>
          {/* Brand */}
          <Button
            as={RouterLink}
            to="/"
            variant="ghost"
            px={2}
            _hover={{ bg: "transparent", transform: "translateY(-1px)" }}
          >
            <Text
              fontSize={{ base: "3xl", md: "7xl" }}
              fontWeight="black"
              letterSpacing="widest"
              bgGradient="linear(to-r, teal.300, cyan.400)"
              bgClip="text"
              mr={1}
            >
              TESSERA.
            </Text>
          </Button>

          <Spacer />

          {/* Desktop nav */}
          <Show above="md">
            <HStack spacing={2}>
              <NavLink to="/" icon={<MdHomeFilled />}>
                home
              </NavLink>
              <NavLink to="/events" icon={<LuPartyPopper />}>
                events
              </NavLink>
              <NavLink to="/user/profile" icon={<SiAseprite />}>
                profile
              </NavLink>

              {token ? (
                <Button
                  onClick={handleLogout}
                  size="sm"
                  variant="outline"
                  colorScheme="teal"
                  rounded="lg"
                  fontWeight="extrabold"
                >
                  log out
                </Button>
              ) : (
                <Button
                  as={RouterLink}
                  to="/login"
                  size="sm"
                  colorScheme="teal"
                  rounded="lg"
                  fontWeight="extrabold"
                >
                  log in
                </Button>
              )}

              <ColorModeButton />
            </HStack>
          </Show>

          {/* Mobile menu */}
          <Hide above="md">
            <HStack spacing={2}>
              <ColorModeButton />
              <Menu>
                <MenuButton
                  as={IconButton}
                  aria-label="Menu"
                  icon={<FiMenu />}
                  variant="outline"
                  colorScheme="teal"
                  size="sm"
                  rounded="lg"
                />
                <MenuList>
                  <MenuItem as={RouterLink} to="/" icon={<MdHomeFilled />}>
                    home
                  </MenuItem>
                  <MenuItem as={RouterLink} to="/events" icon={<LuPartyPopper />}>
                    events
                  </MenuItem>
                  <MenuItem as={RouterLink} to="/user/profile" icon={<SiAseprite />}>
                    profile
                  </MenuItem>
                  {token ? (
                    <MenuItem onClick={handleLogout}>log out</MenuItem>
                  ) : (
                    <MenuItem as={RouterLink} to="/login">
                      log in
                    </MenuItem>
                  )}
                </MenuList>
              </Menu>
            </HStack>
          </Hide>
        </Flex>
      </Container>
    </Box>
  );
}