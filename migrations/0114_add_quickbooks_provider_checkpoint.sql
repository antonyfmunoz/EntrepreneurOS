-- QuickBooks is the authoritative accounting ledger in the current Notion tech
-- stack. Existing customer-value rehearsal rows are preserved; this migration
-- only expands the provider allow-list for newly compiled checkpoints.
ALTER TABLE eos_customer_value_provider_checkpoints
  DROP CONSTRAINT IF EXISTS eos_customer_value_provider_checkpoint_provider_check;

ALTER TABLE eos_customer_value_provider_checkpoints
  ADD CONSTRAINT eos_customer_value_provider_checkpoint_provider_check
  CHECK (provider_key IN ('gohighlevel','stripe','docusign','google-workspace','notion','quickbooks'));
