// src/pages/EventDetail.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

/* ---------- Helpers ---------- */

// Convert `/events/:id/tickets` rows into react-seat-picker shape
// Input rows must contain: row_name, seat_number, status, base_price
function ticketsToRows(tickets) {
  if (!Array.isArray(tickets) || tickets.length === 0) return [];

  // group by row (A, B, C…)
  const byRow = new Map();
  for (const t of tickets) {
    const row = t.row_name;
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push(t);
  }

  // sort rows alphabetically (A, B, C…)
  const rowNames = [...byRow.keys()].sort((a, b) => a.localeCompare(b));

  return rowNames.map((rowName) => {
    const seats = byRow.get(rowName).sort((a, b) => a.seat_number - b.seat_number);

    const maxSeat = seats.length ? seats[seats.length - 1].seat_number : 0;
    const byNumber = new Map(seats.map((s) => [s.seat_number, s]));
    const rowArray = [];

    for (let n = 1; n <= maxSeat; n++) {
      const t = byNumber.get(n);
      if (!t) {
        // gap/aisle (no seat created at this position)
        rowArray.push(null);
        continue;
      }
      const isAvailable = t.status === "AVAILABLE";
      rowArray.push({
        id: `${rowName}${n}`,
        number: n,
        // Disable click only if not available (RESERVED/SOLD from server)
        isReserved: !isAvailable,
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

/* ---------- Best available (cart-only) ---------- */
/**
 * Finds the "best" contiguous block of seats of size qty **that are currently clickable**.
 * Heuristics:
 *  - Prefer earlier rows (A before B…)
 *  - Prefer blocks closest to the center of the row
 *  - Tie-break by lower average price
 */
function findBestBlock(rows, qty, priceById) {
  if (!rows?.length || qty < 1) return null;

  // Map row index -> label by peeking first non-null seat
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

    // Scan “runs” of clickable seats (seat != null && !seat.isReserved)
    let i = 0;
    while (i < row.length) {
      while (i < row.length && (!row[i] || row[i].isReserved)) i++;
      if (i >= row.length) break;

      let j = i;
      while (j < row.length && row[j] && !row[j].isReserved) j++;

      // Now we have an available run [i, j)
      const runLen = j - i;
      if (runLen >= qty) {
        for (let start = i; start <= j - qty; start++) {
          const block = row.slice(start, start + qty);
          const ids = block.map((s) => s.id);
          const nums = block.map((s) => s.number);

          // price/center scoring
          const avgPrice = ids.reduce((acc, id) => acc + (priceById[id] || 0), 0) / qty;

          const rowSeatNums = row.filter(Boolean).map((s) => s.number);
          const minNum = rowSeatNums.length ? Math.min(...rowSeatNums) : 1;
          const maxNum = rowSeatNums.length ? Math.max(...rowSeatNums) : 1;
          const center = (minNum + maxNum) / 2;
          const blockCenter = (nums[0] + nums[nums.length - 1]) / 2;
          const centerDistance = Math.abs(blockCenter - center);

          // Lower score is better
          const score = rIndex * 10000 + centerDistance * 100 + avgPrice;

          if (!best || score < best.score) {
            best = {
              score,
              rowLabel: rowLabels[rIndex],
              ids,
              seatNumbers: nums,
            };
          }
        }
      }
      i = j;
    }
  }

  return best;
}

/* ---------- Page ---------- */

export default function EventDetail() {
  const { id } = useParams();
  const toast = useToast();

  const [rows, setRows] = useState([]);            // map for seat-picker
  const [selected, setSelected] = useState([]);    // cart: ["A1","A2",...]
  const [loading, setLoading] = useState(false);
  const [loadingMap, setLoadingMap] = useState(true);

  const [payOpen, setPayOpen] = useState(false);
  const [bestQty, setBestQty] = useState(2);

  // Load live inventory (SOLD/RESERVED/AVAILABLE)
  const loadMap = async () => {
    setLoadingMap(true);
    try {
      const res = await fetch(`http://localhost:5000/events/${id}/tickets`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRows(ticketsToRows(data));
    } catch (e) {
      console.warn("Map load failed:", e?.message || e);
      setRows([]); // empty map instead of demo to avoid confusion
    } finally {
      setLoadingMap(false);
    }
  };

  useEffect(() => {
    setSelected([]); // reset cart when switching events
    loadMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Price lookup for totals/tooltips
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
  const amountCents = Math.round(total * 100);
  const token = localStorage.getItem("access_token");

  /* ---------- Click (cart-only; no server reserve) ---------- */
  const addSeatCallback = ({ row, number }, addCb) => {
    const sid = seatId(row, number);
    setSelected((prev) => (prev.includes(sid) ? prev : [...prev, sid]));
    // Let seat-picker paint it as selected
    addCb(row, number, sid, "Added to cart");
  };

  const removeSeatCallback = ({ row, number }, removeCb) => {
    const sid = seatId(row, number);
    setSelected((prev) => prev.filter((x) => x !== sid));
    removeCb(row, number);
  };

  /* ---------- Best Available (cart-only; no server reserve) ---------- */
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

    // Merge into cart without duplicates
    setSelected((prev) => {
      const next = new Set(prev);
      block.ids.forEach((id) => next.add(id));
      return [...next];
    });

    toast({
      title: "Added to cart",
      description: `${block.rowLabel}${block.seatNumbers[0]}–${
        block.rowLabel
      }${block.seatNumbers[block.seatNumbers.length - 1]} (${qty})`,
      status: "success",
      duration: 2000,
      isClosable: true,
    });

    // Also visually mark selected in the grid:
    // We can’t call addCb from here, so quick trick: reload map then
    // re-apply selection on render (react-seat-picker will paint them as selected
    // because we pass addSeatCallback only on user click).
    // Instead of hacking addCb, we’ll leave the UI as-is — the cart chips reflect selection.
    // (Optional: you can re-render the grid by toggling a key if you want visual “selected” state.)
  };

  /* ---------- Checkout ---------- */
  const onPurchase = () => {
    if (!selected.length) return;
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
    setPayOpen(true);
  };

  const selectedSeatsForServer = useMemo(
    () =>
      selected.map((sid) => {
        const { row, seat } = parseSeatId(sid);
        return { row, seat };
      }),
    [selected]
  );

  const refreshAfterSuccess = async () => {
    setSelected([]);
    await loadMap();
  };

  /* ---------- UI ---------- */
  return (
    <Box px={{ base: 4, md: 10 }} py={6}>
      <Flex gap={8} direction={{ base: "column", lg: "row" }}>
        {/* Left: event card (placeholder) */}
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

            {/* Best available controls (cart-only) */}
            <HStack mb={3} gap={3} flexWrap="wrap">
              <HStack>
                <Text fontSize="sm" opacity={0.85}>
                  Best available for
                </Text>
                <Select
                  size="sm"
                  value={bestQty}
                  onChange={(e) => setBestQty(Number(e.target.value))}
                  w="72px"
                  bg="rgba(255,255,255,0.04)"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
                <Text fontSize="sm" opacity={0.85}>
                  seats
                </Text>
              </HStack>
              <Button
                size="sm"
                colorScheme="blue"
                variant="solid"
                onClick={onBestAvailable}
                isLoading={loading}
              >
                Best available
              </Button>
            </HStack>

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
                  maxReservableSeats={20} // cart-only, so allow more if you want
                  loading={loading}
                  addSeatCallback={addSeatCallback}
                  removeSeatCallback={removeSeatCallback}
                />
              )}
            </Box>
          </Box>

          {/* Cart summary */}
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

      {/* Payment modal (will handle real reserve/payment/purchase) */}
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