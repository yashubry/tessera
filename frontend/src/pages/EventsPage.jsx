import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Container,
  SimpleGrid,
  HStack,
  InputGroup,
  InputLeftElement,
  Input,
  Select,
  Switch,
  FormLabel,
  Spacer,
  Button,
  Skeleton,
  SkeletonText,
  useColorModeValue,
} from "@chakra-ui/react";
import { FiSearch } from "react-icons/fi";
import EventCard from "../components/EventCard";

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [futureOnly, setFutureOnly] = useState(true);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (futureOnly) params.set("afterDate", todayISO());
      if (location) params.set("location", location);
      const res = await fetch(`http://localhost:5000/events?${params.toString()}`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [futureOnly, location]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return events;
    return events.filter(
      (e) =>
        e.name?.toLowerCase().includes(term) ||
        e.description?.toLowerCase().includes(term)
    );
  }, [events, q]);

  const cardBg = useColorModeValue("gray.50", "gray.800");

  return (
    <Container maxW="7xl" py={6}>
      <HStack mb={5} spacing={4}>
        <InputGroup maxW="420px">
          <InputLeftElement pointerEvents="none"><FiSearch /></InputLeftElement>
          <Input placeholder="Search events" value={q} onChange={(e) => setQ(e.target.value)} />
        </InputGroup>

        <Select
          placeholder="All locations"
          maxW="220px"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        >
          <option value="harris peeter hall">Harris Peeter Hall</option>
          <option value="NYC">NYC</option>
          <option value="LA">LA</option>
        </Select>

        <HStack>
          <FormLabel htmlFor="futureOnly" mb="0">Future only</FormLabel>
          <Switch id="futureOnly" isChecked={futureOnly} onChange={(e) => setFutureOnly(e.target.checked)} />
        </HStack>

        <Spacer />
        <Button onClick={fetchEvents} variant="outline">Refresh</Button>
      </HStack>

      {loading ? (
        <SimpleGrid minChildWidth="460px" spacing={6}>
          {[...Array(6)].map((_, i) => (
            <Box key={i} rounded="xl" overflow="hidden" bg={cardBg} borderWidth="1px">
              <Skeleton height="100px" />
              <Box p={5}>
                <SkeletonText noOfLines={4} spacing="3" />
              </Box>
            </Box>
          ))}
        </SimpleGrid>
      ) : filtered.length === 0 ? (
        <Box borderWidth="1px" rounded="xl" p={8} textAlign="center" opacity={0.85}>
          No events match your filters.
        </Box>
      ) : (
        <SimpleGrid minChildWidth="460px" spacing={6}>
          {filtered.map((e) => (
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
  );
}
