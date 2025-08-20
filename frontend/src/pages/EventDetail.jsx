// src/pages/EventDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import SeatPicker from "react-seat-picker";
import PaymentModal from "../components/PaymentModal";
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

// ---------- Helpers -----------------------------------------------------------

// Build react-seat-picker rows from backend /events/:id/tickets
// Expects items like: { row_name: "A", seat_number: 1, status: "AVAILABLE"|"RESERVED"|"SOLD", base_price: 30 }
function ticketsToRows(tickets) {
  if (!Array.isArray(tickets) || tickets.length === 0) return [];

  // Group by row (A, B, C, ...)
  const byRow = new Map();
  for (const t of tickets) {
    const row = t.row_name;
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push(t);
  }

  // Sort rows alphabetically (A..Z, AA..)
  const rowNames = [...byRow.keys()].sort((a, b) => a.localeCompare(b));

  return rowNames.map((rowName) => {
    const seats = byRow
      .get(rowName)
      .sort((a, b) => a.seat_number - b.seat_number);

    // Render 1..max seat number so width matches how many seats exist
    const maxSeat = seats.length ? seats[seats.length - 1].seat_number : 0;
    const byNumber = new Map(seats.map((s) => [s.seat_number, s]));

    const rowArray = [];
    for (let n = 1; n <= maxSeat; n++) {
      const t = byNumber.get(n);
      if (!t) {
        // If you ever skip numbers to create an aisle, keep a null gap
        rowArray.push(null);
        continue;
      }
      const isAvailable = t.status === "AVAILABLE";
      rowArray.push({
        id: `${rowName}${n}`,
        number: n,
        isReserved: !isAvailable, // RESERVED & SOLD render as disabled
        tooltip:
          typeof t.base_price === "number" ? `$${t.base_price}` : undefined,
      });
    }
    return rowArray;
  });
}

const priceFromTooltip = (tooltip) =>
  Number(String(tooltip || "$0").replace("$", "")) || 0;

const seatId = (row, number) => `${row}${number}`;

// robustly parse ids like "A1" or "AA12"
const parseSeatId = (sid) => {
  const m = String(sid).match(/^([A-Za-z]+)(\d+)$/);
  return { row: m ? m[1] : "", seat: m ? parseInt(m[2], 10) : NaN };
};

// ---------- Page --------------------------------------------------------------

export default function EventDetail() {
  const { id } = useParams();
  const toast = useToast();

  // Seat map state (no demo fallback)
  const [rows, setRows] = useState([]);
  const [loadingMap, setLoadingMap] = useState(true);

  // Local selection (["A1","B2",...]) + button loading
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  // Stripe payment modal
  const [payOpen, setPayOpen] = useState(false);

  const token = localStorage.getItem("access_token");

  // Load inventory for this event
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingMap(true);
        const res = await fetch(`http://localhost:5000/events/${id}/tickets`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (mounted) setRows(ticketsToRows(data));
      } catch (e) {
        console.error("Failed to load tickets:", e);
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoadingMap(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Price map for total
  const priceById = useMemo(() => {
    const map = {};
    for (const r of rows) for (const s of r) if (s) map[s.id] = priceFromTooltip(s.tooltip);
    return map;
  }, [rows]);

  const total = selected.reduce((sum, sid) => sum + (priceById[sid] || 0), 0);
  const amountCents = Math.round(total * 100);

  // --- Seat picker callbacks -------------------------------------------------

  const addSeatCallback = async ({ row, number }, addCb) => {
    setLoading(true);
    const sid = seatId(row, number);

    try {
      if (token) {
        const { row: rowLabel, seat } = parseSeatId(sid);
        const res = await fetch(
          `http://localhost:5000/events/${id}/tickets/reserve`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ seats: [{ row: rowLabel, seat }] }),
          }
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Reserve failed");
        }
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
        const { row: rowLabel, seat } = parseSeatId(sid);
        const res = await fetch(
          `http://localhost:5000/events/${id}/tickets/unreserve`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ seats: [{ row: rowLabel, seat }] }),
          }
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Unreserve failed");
        }
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

  // --- Purchase --------------------------------------------------------------

  const onPurchase = () => {
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
    setPayOpen(true);
  };

  const selectedSeatsForServer = useMemo(
    () => selected.map((sid) => parseSeatId(sid)),
    [selected]
  );

  // After successful payment/fulfillment: clear cart + refresh map
  const refreshAfterSuccess = async () => {
    setSelected([]);
    const res = await fetch(`http://localhost:5000/events/${id}/tickets`);
    if (res.ok) {
      const data = await res.json();
      setRows(ticketsToRows(data));
    }
  };

  // ---------- UI -------------------------------------------------------------

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
              ) : rows.length === 0 ? (
                <Text textAlign="center" py={6} opacity={0.8}>
                  No seats found for this event.
                </Text>
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

      {/* Stripe payment modal */}
      <PaymentModal
        isOpen={payOpen}
        onClose={() => setPayOpen(false)}
        eventId={id}
        seats={selectedSeatsForServer}
        amountCents={amountCents}
        token={token}
        onSuccess={refreshAfterSuccess}
      />
    </Box>
  );
}
