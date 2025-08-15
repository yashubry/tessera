// src/pages/EventDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import SeatPicker from "react-seat-picker";
import {
  Box,
  Flex,
  Heading,
  Text,
  Badge,
  Button,
  Image,
  HStack,
  VStack,
  Divider,
  Spinner,
  useToast,
  Tag,
  TagLabel,
  TagCloseButton,
} from "@chakra-ui/react";
import { CheckCircleIcon } from "@chakra-ui/icons";

// ------- Helpers -------------------------------------------------------------

const demoRows = [
  [
    { id: "A1", number: 1, tooltip: "$30" },
    { id: "A2", number: 2, tooltip: "$30" },
    { id: "A3", number: 3, isReserved: true, tooltip: "$30" },
    null,
    { id: "A4", number: 4, tooltip: "$30" },
    { id: "A5", number: 5, tooltip: "$30" },
    { id: "A6", number: 6, tooltip: "$30" },
  ],
  [
    { id: "B1", number: 1, isReserved: true, tooltip: "$20" },
    { id: "B2", number: 2, isReserved: true, tooltip: "$20" },
    { id: "B3", number: 3, isReserved: true, tooltip: "$20" },
    null,
    { id: "B4", number: 4, tooltip: "$20" },
    { id: "B5", number: 5, tooltip: "$20" },
    { id: "B6", number: 6, tooltip: "$20" },
  ],
];

// Convert `/events/:id/tickets` rows into react-seat-picker shape
function ticketsToRows(tickets) {
  if (!tickets?.length) return demoRows;

  const byRow = {};
  for (const t of tickets) {
    const row = t.row_name;
    if (!byRow[row]) byRow[row] = [];
    byRow[row].push(t);
  }

  const sortedRowNames = Object.keys(byRow).sort((a, b) =>
    a.localeCompare(b)
  );

  return sortedRowNames.map((rowName) => {
    const seats = byRow[rowName]
      .sort((a, b) => a.seat_number - b.seat_number)
      .map((t) => ({
        id: `${rowName}${t.seat_number}`,
        number: t.seat_number,
        isReserved: t.status !== "AVAILABLE",
        tooltip: `$${t.base_price}`,
      }));
    return seats;
  });
}

const priceFromTooltip = (tooltip) =>
  Number(String(tooltip || "$0").replace("$", "")) || 0;

const seatId = (row, number) => `${row}${number}`;

// ------- Page ----------------------------------------------------------------

export default function EventDetail() {
  const { id } = useParams();
  const toast = useToast();

  const [rows, setRows] = useState(demoRows);
  const [selected, setSelected] = useState([]); // ["A1", "B2", ...]
  const [loading, setLoading] = useState(false);
  const [loadingMap, setLoadingMap] = useState(true);

  // Try to load real inventory; fall back to demoRows on error
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoadingMap(true);
        const res = await fetch(`http://localhost:5000/events/${id}/tickets`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!mounted) return;
        setRows(ticketsToRows(data));
      } catch (e) {
        console.warn("Falling back to demo map:", e?.message || e);
        if (mounted) setRows(demoRows);
      } finally {
        if (mounted) setLoadingMap(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Price map for total
  const priceById = useMemo(() => {
    const map = {};
    for (const r of rows) {
      for (const s of r) {
        if (s) map[s.id] = priceFromTooltip(s.tooltip);
      }
    }
    return map;
  }, [rows]);

  const total = selected.reduce((sum, sid) => sum + (priceById[sid] || 0), 0);
  const token = localStorage.getItem("access_token");

  // Callbacks for react-seat-picker
  const addSeatCallback = async ({ row, number }, addCb) => {
    setLoading(true);
    const sid = seatId(row, number);

    try {
      if (token) {
        const res = await fetch(
          `http://localhost:5000/events/${id}/tickets/reserve`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ seats: [{ row, seat: number }] }),
          }
        );
        if (!res.ok) throw new Error((await res.json()).error || "Reserve failed");
      }

      setSelected((prev) => (prev.includes(sid) ? prev : [...prev, sid]));
      addCb(row, number, sid, "Added to cart");
    } catch (e) {
      toast({
        title: "Could not reserve",
        description: e.message,
        status: "error",
        duration: 3500,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const removeSeatCallback = async ({ row, number }, removeCb) => {
    setLoading(true);
    const sid = seatId(row, number);

    try {
      if (token) {
        const res = await fetch(
          `http://localhost:5000/events/${id}/tickets/unreserve`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ seats: [{ row, seat: number }] }),
          }
        );
        if (!res.ok) throw new Error((await res.json()).error || "Unreserve failed");
      }

      setSelected((prev) => prev.filter((x) => x !== sid));
      removeCb(row, number);
    } catch (e) {
      toast({
        title: "Could not unreserve",
        description: e.message,
        status: "error",
        duration: 3500,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const onPurchase = async () => {
    if (!selected.length) return;

    if (!token) {
      toast({
        title: "Login required",
        description: "Log in to complete your purchase.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setLoading(true);
      const seats = selected.map((sid) => ({
        row: sid[0],
        seat: parseInt(sid.slice(1), 10),
      }));

      const res = await fetch(
        `http://localhost:5000/events/${id}/tickets/purchase`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ seats }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Purchase failed");
      }

      toast({
        title: "Purchase complete",
        description: "Your seats are now yours 🎉",
        status: "success",
        duration: 3000,
        isClosable: true,
        icon: <CheckCircleIcon color="green.300" />,
      });

      setSelected([]);
      const fresh = await fetch(`http://localhost:5000/events/${id}/tickets`);
      if (fresh.ok) {
        const data = await fresh.json();
        setRows(ticketsToRows(data));
      }
    } catch (e) {
      toast({
        title: "Payment/fulfillment error",
        description: e.message,
        status: "error",
        duration: 3500,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // --- UI --------------------------------------------------------------------
  return (
    <Box px={{ base: 4, md: 10 }} py={6}>
      <Flex gap={8} direction={{ base: "column", lg: "row" }}>
        <Box
          flex="0 0 360px"
          bg="#0f172a"
          border="1px solid rgba(255,255,255,0.08)"
          rounded="xl"
          overflow="hidden"
          shadow="md"
        >
          <Image
            src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop"
            alt="Event poster"
            h="220px"
            w="100%"
            objectFit="cover"
          />
          <VStack align="stretch" spacing={3} p={5}>
            <Heading size="md">Event #{id}</Heading>
            <HStack spacing={2}>
              <Badge colorScheme="blue">Music</Badge>
              <Badge colorScheme="purple">Indoor</Badge>
            </HStack>
            <Text opacity={0.8}>
              Pick your seats, reserve, and checkout. Hook this card up to your
              real event data anytime.
            </Text>
            <Divider opacity={0.12} />
            <HStack fontSize="sm" opacity={0.9}>
              <Text>Date:</Text>
              <Text fontWeight="semibold">2025-08-20</Text>
            </HStack>
            <HStack fontSize="sm" opacity={0.9}>
              <Text>Time:</Text>
              <Text fontWeight="semibold">01:00</Text>
            </HStack>
            <HStack fontSize="sm" opacity={0.9}>
              <Text>Location:</Text>
              <Text fontWeight="semibold">Harris Peeter Hall</Text>
            </HStack>
          </VStack>
        </Box>

        <Box flex="1">
          <Box
            bg="#0f172a"
            border="1px solid rgba(255,255,255,0.08)"
            rounded="xl"
            p={5}
            shadow="md"
          >
            <Flex justify="space-between" align="center" mb={3}>
              <Heading size="md">Select your seats</Heading>
              <HStack>
                <Badge colorScheme="green">Available</Badge>
                <Badge colorScheme="gray">Reserved</Badge>
                <Badge colorScheme="red">Sold</Badge>
              </HStack>
            </Flex>

            <Box
              border="1px solid rgba(255,255,255,0.12)"
              rounded="lg"
              p={4}
              minH="140px"
            >
              <Text textAlign="center" mb={2} fontWeight="semibold">
                Stage
              </Text>

              {loadingMap ? (
                <HStack justify="center" py={10}>
                  <Spinner />
                  <Text>Loading map…</Text>
                </HStack>
              ) : (
                <SeatPicker
                  rows={rows}
                  alpha
                  visible
                  maxReservableSeats={6}
                  loading={loading}
                  addSeatCallback={addSeatCallback}
                  removeSeatCallback={removeSeatCallback}
                />
              )}
            </Box>
          </Box>

          <Flex
            mt={4}
            bg="#0f172a"
            border="1px solid rgba(255,255,255,0.08)"
            rounded="xl"
            p={4}
            align="center"
            justify="space-between"
            flexWrap="wrap"
            gap={3}
          >
            <HStack spacing={2} flex="1" minW="260px">
              <Text fontWeight="semibold">Selected:</Text>
              {selected.length === 0 ? (
                <Text opacity={0.7}>none</Text>
              ) : (
                <HStack spacing={2} flexWrap="wrap">
                  {selected.map((sid) => (
                    <Tag key={sid} size="md" colorScheme="blue" variant="subtle">
                      <TagLabel>
                        {sid} • ${priceById[sid]?.toFixed(0)}
                      </TagLabel>
                      <TagCloseButton
                        onClick={() =>
                          setSelected((prev) => prev.filter((x) => x !== sid))
                        }
                      />
                    </Tag>
                  ))}
                </HStack>
              )}
            </HStack>

            <HStack>
              <Text fontWeight="bold">Total:</Text>
              <Text fontWeight="extrabold">${total.toFixed(2)}</Text>
              <Button
                leftIcon={<CheckCircleIcon />}
                colorScheme="blue"
                onClick={onPurchase}
                isDisabled={!selected.length || loading}
                isLoading={loading}
              >
                Purchase
              </Button>
            </HStack>
          </Flex>
        </Box>
      </Flex>
    </Box>
  );
}