import React, { useState } from "react";
import {
  Box, Button, Container, FormControl, FormLabel, Heading, HStack, Input,
  Stack, Textarea, Switch, NumberInput, NumberInputField, useToast, Text, Divider,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import useMe from "../hooks/useMe";

export default function AdminEventCreate() {
  const toast = useToast();
  const navigate = useNavigate();
  const { isAdmin, loading } = useMe();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");      // yyyy-mm-dd
  const [time, setTime] = useState("");      // HH:MM (24h or 12h fine)
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // seating generation
  const [genNow, setGenNow] = useState(false);
  const [rows, setRows] = useState(5);
  const [seatsPerRow, setSeatsPerRow] = useState(10);
  const [premiumRows, setPremiumRows] = useState("A,B"); // comma-separated

  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <Container maxW="3xl" py={10}>
        <Heading size="md">Loading…</Heading>
      </Container>
    );
  }
  if (!isAdmin) {
    return (
      <Container maxW="3xl" py={10}>
        <Heading size="lg" mb={3}>403 • Admins only</Heading>
        <Text>You must be signed in as <b>yashu.bry04@gmail.com</b> to access this page.</Text>
      </Container>
    );
  }

  const createEvent = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      toast({ title: "Login required", status: "warning" });
      return null;
    }

    const payload = { name, description, date, time, location, image_url: imageUrl };

    const res = await fetch("http://localhost:5000/admin/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Create event failed");
    }
    return res.json(); // should include event_id
  };

  const generateSeating = async (eventId) => {
    const token = localStorage.getItem("access_token");
    const premium = premiumRows
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const res = await fetch(
      `http://localhost:5000/admin/events/${eventId}/tickets/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          num_rows: Number(rows),
          seats_per_row: Number(seatsPerRow),
          premium_rows: premium,
          default_price_code_id: 1,
          premium_price_code_id: 2,
        }),
      }
    );

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Generate seating failed");
    }
    return res.json();
  };

  const onSubmit = async () => {
    if (!name || !date || !time || !location) {
      toast({ title: "Missing required fields", status: "error" });
      return;
    }
    try {
      setSubmitting(true);
      const ev = await createEvent(); // { event_id, ... }
      const eventId = ev?.event_id;
      if (!eventId) throw new Error("Backend did not return event_id");

      if (genNow) {
        await generateSeating(eventId);
      }

      toast({ title: "Event created", status: "success" });
      navigate(`/events/${eventId}`);
    } catch (e) {
      toast({ title: "Error", description: e.message, status: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxW="3xl" py={8}>
      <Heading mb={6}>Create event</Heading>
      <Stack spacing={5}>
        <FormControl isRequired>
          <FormLabel>Name</FormLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormControl>

        <FormControl>
          <FormLabel>Description</FormLabel>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormControl>

        <HStack>
          <FormControl isRequired>
            <FormLabel>Date</FormLabel>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Time</FormLabel>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </FormControl>
        </HStack>

        <FormControl isRequired>
          <FormLabel>Location</FormLabel>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </FormControl>

        <FormControl>
          <FormLabel>Image URL</FormLabel>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
        </FormControl>

        <Divider />

        <HStack justify="space-between">
          <Text fontWeight="semibold">Generate seating now</Text>
          <Switch isChecked={genNow} onChange={(e) => setGenNow(e.target.checked)} />
        </HStack>

        {genNow && (
          <Box
            border="1px solid"
            borderColor="whiteAlpha.200"
            rounded="lg"
            p={4}
          >
            <HStack>
              <FormControl isRequired>
                <FormLabel>Number of rows</FormLabel>
                <NumberInput min={1} max={26} value={rows} onChange={(v) => setRows(v)}>
                  <NumberInputField />
                </NumberInput>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Seats per row</FormLabel>
                <NumberInput min={1} value={seatsPerRow} onChange={(v) => setSeatsPerRow(v)}>
                  <NumberInputField />
                </NumberInput>
              </FormControl>
            </HStack>
            <FormControl mt={3}>
              <FormLabel>Premium rows (comma-separated)</FormLabel>
              <Input value={premiumRows} onChange={(e) => setPremiumRows(e.target.value)} />
            </FormControl>
          </Box>
        )}

        <Button
          colorScheme="teal"
          size="lg"
          onClick={onSubmit}
          isLoading={submitting}
        >
          Create
        </Button>

        <Text fontSize="sm" opacity={0.7}>
          Only admins can create events. You are signed in as <b>yashu.bry04@gmail.com</b>.
        </Text>
      </Stack>
    </Container>
  );
}