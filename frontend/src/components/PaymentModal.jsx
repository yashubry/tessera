// src/components/PaymentModal.jsx
import React, { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, Button, Box, Text, useToast,
} from "@chakra-ui/react";

// Put your publishable test key here (or read from env)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_test_XXXXXXXXXXXXXXXXXXXXXXXX");

function InnerForm({ isOpen, onClose, eventId, seats, amount, token, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const createIntent = async () => {
    const res = await fetch(`http://localhost:5000/events/${eventId}/payments/create-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ seats }),
    });
    if (!res.ok) {
      throw new Error((await res.json()).error || "Failed to create payment intent");
    }
    return res.json();
  };

  const complete = async (payment_intent_id) => {
    const res = await fetch(`http://localhost:5000/events/${eventId}/payments/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ seats, payment_intent_id }),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Fulfillment failed");
    return res.json();
  };

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    try {
      const { clientSecret, paymentIntentId } = await createIntent();

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });

      if (result.error) throw new Error(result.error.message || "Card confirmation failed");
      if (result.paymentIntent.status !== "succeeded") throw new Error("Payment not completed");

      await complete(paymentIntentId);

      toast({ title: "Payment successful", status: "success", duration: 2500, isClosable: true });
      onSuccess?.();
      onClose();
    } catch (e) {
      toast({ title: "Payment error", description: e.message, status: "error", duration: 4000, isClosable: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ModalBody>
        <Box mb={3}>
          <Text>Total: <b>${(amount / 100).toFixed(2)}</b></Text>
        </Box>
        <Box border="1px solid rgba(255,255,255,0.16)" p={3} rounded="md">
          <CardElement />
        </Box>
        <Box mt={3} fontSize="sm" opacity={0.8}>
          Use Stripe test card 4242 4242 4242 4242, any future expiry, any CVC.
        </Box>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" mr={3} onClick={onClose} isDisabled={submitting}>Cancel</Button>
        <Button colorScheme="blue" onClick={handlePay} isLoading={submitting} loadingText="Paying">Pay</Button>
      </ModalFooter>
    </>
  );
}

export default function PaymentModal({ isOpen, onClose, eventId, seats, amountCents, token, onSuccess }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Checkout</ModalHeader>
        <ModalCloseButton />
        <Elements stripe={stripePromise}>
          <InnerForm
            isOpen={isOpen}
            onClose={onClose}
            eventId={eventId}
            seats={seats}
            amount={amountCents}
            token={token}
            onSuccess={onSuccess}
          />
        </Elements>
      </ModalContent>
    </Modal>
  );
}