-- Distinguish an issued sequential recipient whose routing order is not yet
-- active from a recipient who has actually received a manually deliverable
-- link. This state never claims provider delivery.

ALTER TABLE eos_esign_recipients
  DROP CONSTRAINT IF EXISTS eos_esign_recipient_delivery_state_check;

ALTER TABLE eos_esign_recipients
  ADD CONSTRAINT eos_esign_recipient_delivery_state_check
  CHECK (delivery_state IN ('routing_wait','manual_ready','sending','delivered','failed','uncertain'));
