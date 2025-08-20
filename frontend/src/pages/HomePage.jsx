import React, { useEffect, useState } from "react";
import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  HStack,
  VStack,
  SimpleGrid,
  useColorModeValue,
  Skeleton,
  SkeletonText,
  Tag,
  TagLabel,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiShield, FiCreditCard, FiMap } from "react-icons/fi";
import EventCard from "../components/EventCard";

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function HomePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // fetch a few upcoming events
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `http://localhost:5000/events?afterDate=${todayISO()}`
        );
        const data = await res.json();
        setEvents(Array.isArray(data) ? data.slice(0, 3) : []);
      } catch (e) {
        console.error(e);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const heroBg = useColorModeValue(
    "linear-gradient(135deg,#E8F5FF 0%,#F6F3FF 100%)",
    "linear-gradient(135deg,#0b3a45 0%,#161b33 100%)"
  );

  return (
    <>
      {/* HERO */}
      <Box bg={heroBg} py={{ base: 12, md: 18 }}>
        <Container maxW="7xl">
          <HStack align="center" spacing={{ base: 8, md: 12 }} flexWrap="wrap">
            <VStack align="start" spacing={5} flex="1" minW="320px">
              <Tag colorScheme="teal" size="lg" variant="subtle">
                <TagLabel>Welcome to Tessera</TagLabel>
              </Tag>
              <Heading as="h1" size="2xl" lineHeight="1.1">
                Find your seat. Feel the moment.
              </Heading>
              <Text fontSize="lg" opacity={0.85} maxW="2xl">
                Browse upcoming shows, pick exact seats on our interactive map,
                and check out securely—fast.
              </Text>
              <HStack spacing={4} pt={2}>
                <Button
                  as={Link}
                  to="/events"
                  colorScheme="teal"
                  rightIcon={<FiArrowRight />}
                >
                  Browse events
                </Button>
                <Button as={Link} to="/login" variant="outline">
                  Log in
                </Button>
              </HStack>
            </VStack>

            {/* Optional hero art (kept simple) */}
            <Box
              flex="1"
              minW="320px"
              h={{ base: "220px", md: "280px" }}
              rounded="2xl"
              borderWidth="1px"
              bg={useColorModeValue("white", "gray.800")}
              shadow="md"
              backgroundImage="url('https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZWRtJTIwZmVzdGl2YWx8ZW58MHx8MHx8fDA%3D')"
              backgroundSize="cover"
              backgroundPosition="center"
            />
          </HStack>
        </Container>
      </Box>

      {/* UPCOMING */}
      <Container maxW="7xl" py={{ base: 8, md: 10 }}>
        <HStack justify="space-between" mb={4}>
          <Heading size="lg">Upcoming events</Heading>
          <Button as={Link} to="/events" variant="link" rightIcon={<FiArrowRight />}>
            See all
          </Button>
        </HStack>

        {loading ? (
          <SimpleGrid minChildWidth="360px" spacing={6}>
            {[...Array(3)].map((_, i) => (
              <Box key={i} rounded="xl" overflow="hidden" borderWidth="1px">
                <Skeleton height="200px" />
                <Box p={5}>
                  <SkeletonText noOfLines={4} spacing="3" />
                </Box>
              </Box>
            ))}
          </SimpleGrid>
        ) : events.length === 0 ? (
          <Box borderWidth="1px" rounded="xl" p={8} textAlign="center" opacity={0.85}>
            No upcoming events yet—check back soon.
          </Box>
        ) : (
          <SimpleGrid minChildWidth="360px" spacing={6}>
            {events.map((e) => (
              <EventCard
                key={e.event_id}
                id={e.event_id}
                name={e.name}
                date={e.date}
                time={e.time}
                location={e.location}
                image_url={e.image_url}
              />
            ))}
          </SimpleGrid>
        )}
      </Container>
    </>
  );
}
