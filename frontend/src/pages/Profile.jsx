import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Progress,
  Skeleton,
  SkeletonText,
  Stack,
  Tooltip,
  useColorModeValue,
  useToast,
  VStack,
  Text,
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { FiX } from "react-icons/fi";

const API = "http://localhost:5000";
const getToken = () => localStorage.getItem("token") || "";

const emailValid = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const passwordScore = (pw) => {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s += 30;
  if (/[A-Z]/.test(pw)) s += 20;
  if (/[a-z]/.test(pw)) s += 20;
  if (/\d/.test(pw)) s += 15;
  if (/[^A-Za-z0-9]/.test(pw)) s += 15;
  return Math.min(s, 100);
};

export default function Profile() {
  const toast = useToast();
  const cardBg = useColorModeValue("white", "gray.800");
  const borderCol = useColorModeValue("gray.200", "gray.700");

  // profile state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  // optional extras (only persist if your backend supports them)
  const [avatarUrl, setAvatarUrl] = useState("");
  const [phone, setPhone] = useState("");

  // password change state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const newPwStrength = useMemo(() => passwordScore(newPw), [newPw]);

  // load profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/user/profile`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setUsername(data.username || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setAvatarUrl(data.profile_pic_url || "");
      } catch (e) {
        toast({ status: "error", title: "Couldn't load profile", description: String(e) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  // save profile
  const onSave = async () => {
    if (!username.trim()) {
      toast({ status: "warning", title: "Username is required" });
      return;
    }
    if (!emailValid(email)) {
      toast({ status: "warning", title: "Enter a valid email" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          phone: phone || null,
          profile_pic_url: avatarUrl || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Save failed (${res.status})`);
      }
      toast({ status: "success", title: "Profile updated" });
    } catch (e) {
      toast({ status: "error", title: "Update failed", description: String(e) });
    } finally {
      setSaving(false);
    }
  };

  // change password
  const onChangePassword = async () => {
    if (!currentPw || !newPw) {
      toast({ status: "warning", title: "Enter current and new password" });
      return;
    }
    if (newPwStrength < 60) {
      toast({ status: "info", title: "Choose a stronger password (score ≥ 60)" });
      return;
    }
    setChangingPw(true);
    try {
      const res = await fetch(`${API}/user/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ password: currentPw, new_password: newPw }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Change failed (${res.status})`);
      setCurrentPw("");
      setNewPw("");
      toast({ status: "success", title: "Password updated" });
    } catch (e) {
      toast({ status: "error", title: "Couldn't change password", description: String(e) });
    } finally {
      setChangingPw(false);
    }
  };

  if (loading) {
    return (
      <Container maxW="lg" py={12}>
        <Box borderWidth="1px" borderColor={borderCol} rounded="2xl" p={8} bg={cardBg}>
          <Skeleton height="28px" mb={6} />
          <HStack spacing={4} mb={6}>
            <Skeleton boxSize="72px" rounded="full" />
            <Skeleton height="40px" flex="1" />
          </HStack>
          <SkeletonText noOfLines={6} spacing="4" />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxW="lg" py={{ base: 8, md: 12 }}>
      <Box borderWidth="1px" borderColor={borderCol} rounded="2xl" p={{ base: 6, md: 8 }} bg={cardBg} shadow="md">
        <Heading size="lg" mb={6}>Account</Heading>

        {/* Avatar + URL */}
        <VStack align="stretch" spacing={3} mb={6}>
          <FormLabel>User Icon</FormLabel>
          <HStack spacing={4} align="center">
            <Box position="relative">
              <Avatar size="xl" name={username || "User"} src={avatarUrl || undefined} />
              {avatarUrl && (
                <Tooltip label="Clear image">
                  <IconButton
                    icon={<FiX />}
                    size="xs"
                    aria-label="clear"
                    colorScheme="red"
                    position="absolute"
                    top="-6px"
                    right="-6px"
                    onClick={() => setAvatarUrl("")}
                  />
                </Tooltip>
              )}
            </Box>
            <Input
              placeholder="https://your-cdn.com/avatar.png"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
          </HStack>
        </VStack>

        {/* Profile form */}
        <Stack spacing={4}>
          <FormControl isRequired>
            <FormLabel>User name</FormLabel>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </FormControl>

          <FormControl isRequired isInvalid={email.length > 0 && !emailValid(email)}>
            <FormLabel>Email address</FormLabel>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormControl>

          {/* optional */}
          <FormControl>
            <FormLabel>Phone (optional)</FormLabel>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormControl>

          <HStack pt={2}>
            <Button onClick={() => window.history.back()} variant="outline">Cancel</Button>
            <Button onClick={onSave} colorScheme="blue" isLoading={saving}>Save changes</Button>
          </HStack>
        </Stack>

        <Divider my={8} />

        {/* Password section */}
        <Heading size="md" mb={4}>Security</Heading>
        <Stack spacing={4}>
          <FormControl>
            <FormLabel>Current password</FormLabel>
            <InputGroup>
              <Input
                type={showPw ? "text" : "password"}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="••••••••"
              />
              <InputRightElement>
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label={showPw ? "Hide" : "Show"}
                  icon={showPw ? <ViewOffIcon /> : <ViewIcon />}
                  onClick={() => setShowPw((v) => !v)}
                />
              </InputRightElement>
            </InputGroup>
          </FormControl>

          <FormControl>
            <FormLabel>New password</FormLabel>
            <Input
              type={showPw ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="At least 8 characters"
            />
            <HStack mt={2} spacing={3} align="center">
              <Progress value={newPwStrength} flex="1" borderRadius="md" />
              <Text fontSize="sm" w="70px" textAlign="right">
                {newPwStrength >= 80 ? "Strong" : newPwStrength >= 60 ? "Good" : "Weak"}
              </Text>
            </HStack>
          </FormControl>

          <HStack>
            <Button variant="outline" onClick={() => { setCurrentPw(""); setNewPw(""); }}>Reset</Button>
            <Button colorScheme="purple" onClick={onChangePassword} isLoading={changingPw}>
              Change password
            </Button>
          </HStack>
        </Stack>
      </Box>
    </Container>
  );
}
