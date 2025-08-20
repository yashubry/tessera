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
  Select,
} from "@chakra-ui/react";
import { CheckCircleIcon } from "@chakra-ui/icons";

/* ------------ helpers ------------ */

// Convert /events/:id/tickets rows into react-seat-picker shape
function ticketsToRows(tickets) {
  if (!Array.isArray(tickets) || tickets.length === 0) return [];
  const byRow = new Map();
  for (const t of tickets) {
    if (!byRow.has(t.row_name)) byRow.set(t.row_name, []);
    byRow.get(t.row_name).push(t);
  }
  const rowNames = [...byRow.keys()].sort((a, b) => a.localeCompare(b));
  return rowNames.map((rowName) => {
    const seats = byRow.get(rowName).sort((a, b) => a.seat_number - b.seat_number);
    const maxSeat = seats.length ? seats[seats.length - 1].seat_number : 0;
    const byNumber = new Map(seats.map((s) => [s.seat_number, s]));
    const rowArray = [];
    for (let n = 1; n <= maxSeat; n++) {
      const t = byNumber.get(n);
      if (!t) {
        rowArray.push(null);
        continue;
      }
      rowArray.push({
        id: `${rowName}${n}`,
        number: n,
        isReserved: t.status !== "AVAILABLE", // RESERVED or SOLD
        tooltip: t.base_price != null ? `$${t.base_price}` : undefined,
      });
    }
    return rowArray;
  });
}

const priceFromTooltip = (tooltip) =>
  Number(String(tooltip || "$0").replace("$", "")) || 0;

const seatId = (row, number) => `${row}${number}`;
const parseSeatId = (sid) => {
  const m = String(sid).match(/^([A-Za-z]+)(\d+)$/);
  return { row: m ? m[1] : "", seat: m ? parseInt(m[2], 10) : NaN };
};

// Best-available finder (cart-only)
function findBestBlock(rows, qty, priceById) {
  if (!rows?.length || qty < 1) return null;
  const rowLabels = rows.map((row) => {
    const firstSeat = row?.find((s) => s && s.id);
    if (!firstSeat) return "?";
    const { row: label } = parseSeatId(firstSeat.id);
    return label || "?";
  });

  let best = null;

  for (let rIndex = 0; rIndex < rows.length; rIndex++) {
    const row = rows[rIndex];
    if (!row || row.length === 0) continue;

    let i = 0;
    while (i < row.length) {
      while (i < row.length && (!row[i] || row[i].isReserved)) i++;
      if (i >= row.length) break;

      let j = i;
      while (j < row.length && row[j] && !row[j].isReserved) j++;

      const runLen = j - i;
      if (runLen >= qty) {
        for (let start = i; start <= j - qty; start++) {
          const block = row.slice(start, start + qty);
          const ids = block.map((s) => s.id);
          const nums = block.map((s) => s.number);

          const avgPrice =
            ids.reduce((acc, id) => acc + (priceById[id] || 0), 0) / qty;

          const rowSeatNums = row.filter(Boolean).map((s) => s.number);
          const minNum = rowSeatNums.length ? Math.min(...rowSeatNums) : 1;
          const maxNum = rowSeatNums.length ? Math.max(...rowSeatNums) : 1;
          const center = (minNum + maxNum) / 2;
          const blockCenter = (nums[0] + nums[nums.length - 1]) / 2;
          const centerDistance = Math.abs(blockCenter - center);

          // Lower score wins
          const score = rIndex * 10000 + centerDistance * 100 + avgPrice;

          if (!best || score < best.score) {
            best = { score, rowLabel: rowLabels[rIndex], ids, seatNumbers: nums };
          }
        }
      }
      i = j;
    }
  }
  return best;
}

/* ------------ component ------------ */

export default function EventDetail() {
  const { id } = useParams();
  const toast = useToast();

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
  const getToken = () => localStorage.getItem("access_token");
  const getAuthHeaders = () => {
    const t = getToken();
    return {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    };
  };

  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMap, setLoadingMap] = useState(true);

  // Payment modal state (we create PI after reserving)
  const [payOpen, setPayOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);

  const [bestQty, setBestQty] = useState(2);

  // Load seat map
  const loadMap = async () => {
    setLoadingMap(true);
    try {
      const res = await fetch(`${API_BASE}/events/${id}/tickets`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRows(ticketsToRows(data));
    } catch (e) {
      console.warn("Map load failed:", e?.message || e);
      setRows([]);
    } finally {
      setLoadingMap(false);
    }
  };

  useEffect(() => {
    setSelected([]);
    setClientSecret(null);
    setPaymentIntentId(null);
    loadMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Price lookup
  const priceById = useMemo(() => {
    const map = {};
    for (const r of rows) for (const s of r) if (s) map[s.id] = priceFromTooltip(s.tooltip);
    return map;
  }, [rows]);

  const total = selected.reduce((sum, sid) => sum + (priceById[sid] || 0), 0);
  const amountCents = Math.round(total * 100);

  // SeatPicker callbacks (cart-only)
  const addSeatCallback = ({ row, number }, addCb) => {
    const sid = seatId(row, number);
    setSelected((prev) => (prev.includes(sid) ? prev : [...prev, sid]));
    addCb(row, number, sid, "Added to cart");
  };
  const removeSeatCallback = ({ row, number }, removeCb) => {
    const sid = seatId(row, number);
    setSelected((prev) => prev.filter((x) => x !== sid));
    removeCb(row, number);
  };

  // Best available (cart-only)
  const onBestAvailable = () => {
    const qty = Math.max(1, Math.min(10, Number(bestQty) || 1));
    const block = findBestBlock(rows, qty, priceById);
    if (!block) {
      toast({
        title: "No block available",
        description: `Couldn't find ${qty} adjacent seats.`,
        status: "info",
        duration: 2500,
        isClosable: true,
      });
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      block.ids.forEach((id) => next.add(id));
      return [...next];
    });
    toast({
      title: "Added to cart",
      description: `${block.rowLabel}${block.seatNumbers[0]}–${block.rowLabel}${
        block.seatNumbers.at(-1)
      } (${qty})`,
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  // Selected -> {row, seat} for server
  const selectedSeatsForServer = useMemo(
    () =>
      selected.map((sid) => {
        const { row, seat } = parseSeatId(sid);
        return { row, seat };
      }),
    [selected]
  );

  // Reserve -> create PI -> open modal
  const onPurchase = async () => {
    if (!selected.length) return;

    const token = getToken();
    if (!token) {
      toast({
        title: "Login required",
        description: "Log in to complete your purchase.",
        status: "warning",
        duration: 2500,
        isClosable: true,
      });
      return;
    }

    try {
      setLoading(true);

      // 1) Reserve
      const r1 = await fetch(`${API_BASE}/events/${id}/tickets/reserve`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ seats: selectedSeatsForServer }),
      });

      if (!r1.ok) {
        // Try to parse server message
        let body = null;
        try { body = await r1.clone().json(); } catch {}
        console.error("Reserve failed", r1.status, body || (await r1.text()));

        if (r1.status === 401) {
          throw new Error("Your session expired. Please log in again.");
        }

        if (r1.status === 409 && Array.isArray(body?.seats) && body.seats.length) {
          // Remove conflicting seats from cart and refresh map
          const blocked = body.seats; // ["A1","B3"...]
          setSelected((prev) => prev.filter((sid) => !blocked.includes(sid)));
          toast({
            title: "Checkout unavailable",
            description: `These seats are unavailable: ${blocked.join(", ")}`,
            status: "error",
            duration: 4000,
            isClosable: true,
          });
          await loadMap();
          return; // don't proceed to payment
        }

        throw new Error(body?.error || "Could not reserve seats");
      }

      // 2) Create PaymentIntent
      const r2 = await fetch(`${API_BASE}/events/${id}/payments/create-intent`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ seats: selectedSeatsForServer }),
      });
      const p = await r2.json().catch(() => ({}));
      if (!r2.ok || !p?.clientSecret) {
        // best-effort unreserve if PI creation fails
        await fetch(`${API_BASE}/events/${id}/tickets/unreserve`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ seats: selectedSeatsForServer }),
        }).catch(() => {});
        throw new Error(p?.error || "Could not start payment");
      }

      setClientSecret(p.clientSecret);
      setPaymentIntentId(p.paymentIntentId);
      setPayOpen(true);
    } catch (e) {
      toast({
        title: "Checkout error",
        description: e.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // If user closes modal w/o paying, release the seats
  const handleCloseModal = async () => {
    setPayOpen(false);
    if (clientSecret && paymentIntentId) {
      await fetch(`${API_BASE}/events/${id}/tickets/unreserve`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ seats: selectedSeatsForServer }),
      }).catch(() => {});
    }
    setClientSecret(null);
    setPaymentIntentId(null);
  };

  const handleSuccess = async () => {
    setPayOpen(false);
    setClientSecret(null);
    setPaymentIntentId(null);
    setSelected([]);
    await loadMap();
  };

  return (
    <Box px={{ base: 4, md: 10 }} py={6}>
      <Flex gap={8} direction={{ base: "column", lg: "row" }}>
        {/* Left: event card */}
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
              Pick seats and add to cart. We won’t reserve them until checkout.
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

        {/* Right: map + cart */}
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

            {/* Best available controls */}
            <HStack mb={3} gap={3} flexWrap="wrap">
              <HStack>
                <Text fontSize="sm" opacity={0.85}>Best available for</Text>
                <Select
                  size="sm"
                  value={bestQty}
                  onChange={(e) => setBestQty(Number(e.target.value))}
                  w="72px"
                  bg="rgba(255,255,255,0.04)"
                >
                  {[1,2,3,4,5,6,7,8].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
                <Text fontSize="sm" opacity={0.85}>seats</Text>
              </HStack>
              <Button
                size="sm"
                colorScheme="blue"
                onClick={onBestAvailable}
                isLoading={loading}
              >
                Best available
              </Button>
            </HStack>

            <Box border="1px solid rgba(255,255,255,0.12)" rounded="lg" p={4} minH="140px">
              <Text textAlign="center" mb={2} fontWeight="semibold">Stage</Text>
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
                  maxReservableSeats={20}
                  loading={loading}
                  addSeatCallback={addSeatCallback}
                  removeSeatCallback={removeSeatCallback}
                />
              )}
            </Box>
          </Box>

          {/* Cart */}
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
                        {sid} • ${ (priceById[sid] ?? 0).toFixed(0) }
                      </TagLabel>
                      <TagCloseButton
                        onClick={() => setSelected((prev) => prev.filter((x) => x !== sid))}
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

      {/* Payment modal (we pass clientSecret/PI after reserve) */}
      <PaymentModal
        isOpen={payOpen}
        onClose={handleCloseModal}
        eventId={id}
        seats={selectedSeatsForServer}
        amountCents={amountCents}
        token={getToken()}
        clientSecret={clientSecret}
        paymentIntentId={paymentIntentId}
        onSuccess={handleSuccess}
      />
    </Box>
  );
}