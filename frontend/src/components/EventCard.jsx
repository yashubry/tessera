import React, { useEffect, useState } from "react";
import {
  Box,
  Stack,
  HStack,
  VStack,
  Heading,
  Text,
  Button,
  Tag,
  TagLabel,
  AspectRatio,
  Image,
  Icon,
  Badge,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { FiMapPin, FiCalendar, FiClock, FiChevronRight } from "react-icons/fi";

function formatDate(d) {
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return d;
  }
}
function formatTime(t) {
  return t?.length ? t : "--:--";
}

function useCountdown(dateStr, timeStr) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const target = new Date(`${dateStr}T${timeStr || "00:00"}:00`);
      const ms = target - new Date();
      if (ms <= 0) return setLeft("started");
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((ms / (1000 * 60)) % 60);
      setLeft(`${days}d ${hours}h ${mins}m`);
    };
    tick();
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, [dateStr, timeStr]);
  return left;
}

export default function EventCard({
  id,
  name,
  date,
  time,
  location,
  image_url,
}) {
  const countdown = useCountdown(date, time);

  return (
    <Box
      as="article"
      rounded="2xl"
      overflow="hidden"
      bg="gray.800"
      _light={{ bg: "white" }}
      borderWidth="1px"
      transition="all .2s"
      _hover={{ transform: "translateY(-6px)", shadow: "xl" }}
    >
      {/* Bigger visual: taller image area */}
      <AspectRatio ratio={16 / 9}>
        <Image
          src={
            image_url ||
            "https://images.unsplash.com/photo-1518972559570-7cc1309f3229?q=80&w=1600&auto=format&fit=crop"
          }
          alt={name}
          objectFit="cover"
        />
      </AspectRatio>

      {/* Bigger interior spacing + larger heading */}
      <Stack p={6} spacing={5}>
        <HStack justify="space-between" align="start">
          <Heading size="lg" noOfLines={1}>
            {name}
          </Heading>
          <Badge colorScheme="teal" variant="subtle">
            Event
          </Badge>
        </HStack>

        <VStack
          align="start"
          spacing={2}
          fontSize="md"
          color="gray.300"
          _light={{ color: "gray.600" }}
        >
          <HStack>
            <Icon as={FiCalendar} />
            <Text>{formatDate(date)}</Text>
          </HStack>
          <HStack>
            <Icon as={FiClock} />
            <Text>{formatTime(time)}</Text>
          </HStack>
          <HStack>
            <Icon as={FiMapPin} />
            <Text noOfLines={1}>{location}</Text>
          </HStack>
        </VStack>

        <HStack justify="space-between">
          <Tag
            size="md"
            colorScheme={countdown === "started" ? "red" : "purple"}
          >
            <TagLabel>
              {countdown === "started" ? "event started" : `in ${countdown}`}
            </TagLabel>
          </Tag>
          <Button
            as={Link}
            to={`/events/${id}`}
            rightIcon={<FiChevronRight />}
            colorScheme="teal"
            variant="solid"
            size="md"
          >
            Buy tickets
          </Button>
        </HStack>
      </Stack>
    </Box>
  );
}
