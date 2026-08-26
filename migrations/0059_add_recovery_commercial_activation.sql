CREATE TABLE IF NOT EXISTS eos_recovery_agreement_authorities (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agreement_key text NOT NULL,
  work_packet_id text NOT NULL REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'counsel_blocked',
  version integer NOT NULL DEFAULT 1,
  authority_version text NOT NULL,
  counsel_packet_source text NOT NULL,
  agreement_template_source text NOT NULL,
  issue_dispositions jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer_name text NOT NULL DEFAULT '',
  reviewer_credential_reference text NOT NULL DEFAULT '',
  jurisdiction text NOT NULL DEFAULT '',
  exact_language_reference text NOT NULL DEFAULT '',
  unresolved_business_choices text NOT NULL DEFAULT '',
  compliance_dependencies text NOT NULL DEFAULT '',
  effective_version text NOT NULL DEFAULT '',
  effective_at timestamptz,
  counsel_evidence_id text REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  e_sign_binding_id text REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  external_effects_executed boolean NOT NULL DEFAULT false,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_recovery_agreement_authority_state_check CHECK (state IN ('counsel_blocked','counsel_approved','counsel_approved_with_changes','counsel_rejected','superseded')),
  CONSTRAINT eos_recovery_agreement_authority_version_check CHECK (version > 0),
  CONSTRAINT eos_recovery_agreement_authority_no_effect_check CHECK (external_effects_executed = false)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_agreement_authority_key_idx ON eos_recovery_agreement_authorities(company_id, agreement_key);
CREATE INDEX IF NOT EXISTS eos_recovery_agreement_authority_state_idx ON eos_recovery_agreement_authorities(company_id, state, updated_at);

CREATE TABLE IF NOT EXISTS eos_recovery_agreement_instances (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  call_2_packet_id text NOT NULL REFERENCES eos_recovery_call_2_packets(id) ON DELETE RESTRICT,
  authority_id text NOT NULL REFERENCES eos_recovery_agreement_authorities(id) ON DELETE RESTRICT,
  work_packet_id text NOT NULL REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'blocked_counsel',
  version integer NOT NULL DEFAULT 1,
  client_legal_name text NOT NULL DEFAULT '',
  client_signer_name text NOT NULL DEFAULT '',
  client_signer_email text NOT NULL DEFAULT '',
  provider_legal_name text NOT NULL DEFAULT '',
  package_key text NOT NULL,
  terms_snapshot jsonb NOT NULL,
  agreement_version text NOT NULL DEFAULT '',
  e_sign_template_reference text NOT NULL DEFAULT '',
  e_sign_binding_id text REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  provider_envelope_reference text NOT NULL DEFAULT '',
  provider_receipt_evidence_id text REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_effects_executed boolean NOT NULL DEFAULT false,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_recovery_agreement_instance_state_check CHECK (state IN ('blocked_counsel','blocked_esign','eligible_to_issue','issued','signed','declined','voided','expired')),
  CONSTRAINT eos_recovery_agreement_instance_version_check CHECK (version > 0),
  CONSTRAINT eos_recovery_agreement_instance_no_effect_check CHECK (external_effects_executed = false)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_agreement_instance_packet_idx ON eos_recovery_agreement_instances(call_2_packet_id);
CREATE INDEX IF NOT EXISTS eos_recovery_agreement_instance_state_idx ON eos_recovery_agreement_instances(company_id, state, updated_at);

CREATE TABLE IF NOT EXISTS eos_recovery_billing_manifests (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agreement_instance_id text NOT NULL REFERENCES eos_recovery_agreement_instances(id) ON DELETE RESTRICT,
  work_packet_id text NOT NULL REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'configuration_required',
  version integer NOT NULL DEFAULT 1,
  manifest_version text NOT NULL,
  manifest_source text NOT NULL,
  package_key text NOT NULL,
  setup_amount_minor integer NOT NULL,
  recurring_amount_minor integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  stripe_binding_id text REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  provider_product_reference text NOT NULL DEFAULT '',
  setup_price_reference text NOT NULL DEFAULT '',
  recurring_price_reference text NOT NULL DEFAULT '',
  tax_treatment text NOT NULL DEFAULT '',
  statement_descriptor text NOT NULL DEFAULT '',
  payment_method_policy text NOT NULL DEFAULT '',
  subscription_start_rule text NOT NULL DEFAULT '',
  receipt_behavior text NOT NULL DEFAULT '',
  cancellation_refund_authority text NOT NULL DEFAULT '',
  provider_checkout_reference text NOT NULL DEFAULT '',
  provider_customer_reference text NOT NULL DEFAULT '',
  provider_subscription_reference text NOT NULL DEFAULT '',
  provider_receipt_evidence_id text REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_effects_executed boolean NOT NULL DEFAULT false,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_recovery_billing_manifest_state_check CHECK (state IN ('configuration_required','blocked_agreement','blocked_stripe','checkout_eligible','issued','payment_failed','setup_paid_subscription_pending','active','recovery_required','cancelled','refunded','disputed')),
  CONSTRAINT eos_recovery_billing_manifest_version_check CHECK (version > 0),
  CONSTRAINT eos_recovery_billing_manifest_amounts_check CHECK (setup_amount_minor > 0 AND recurring_amount_minor > 0),
  CONSTRAINT eos_recovery_billing_manifest_currency_check CHECK (currency = 'USD'),
  CONSTRAINT eos_recovery_billing_manifest_no_effect_check CHECK (external_effects_executed = false)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_billing_manifest_agreement_idx ON eos_recovery_billing_manifests(agreement_instance_id);
CREATE INDEX IF NOT EXISTS eos_recovery_billing_manifest_state_idx ON eos_recovery_billing_manifests(company_id, state, updated_at);

CREATE TABLE IF NOT EXISTS eos_recovery_activation_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  activation_id text NOT NULL,
  object_type text NOT NULL,
  object_id text NOT NULL,
  actor_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  sequence integer NOT NULL,
  event_type text NOT NULL,
  from_state text NOT NULL,
  to_state text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  trace_id text NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_recovery_activation_events_object_type_check CHECK (object_type IN ('authority','agreement','billing')),
  CONSTRAINT eos_recovery_activation_events_sequence_check CHECK (sequence > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_activation_events_sequence_idx ON eos_recovery_activation_events(activation_id, sequence);
CREATE INDEX IF NOT EXISTS eos_recovery_activation_events_object_idx ON eos_recovery_activation_events(company_id, object_type, object_id, created_at);

CREATE OR REPLACE FUNCTION eos_reject_recovery_activation_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'recovery activation events are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eos_recovery_activation_events_append_only ON eos_recovery_activation_events;
CREATE TRIGGER eos_recovery_activation_events_append_only
BEFORE UPDATE OR DELETE ON eos_recovery_activation_events
FOR EACH ROW EXECUTE FUNCTION eos_reject_recovery_activation_event_mutation();

CREATE OR REPLACE FUNCTION eos_reject_recovery_activation_external_effect()
RETURNS trigger AS $$
BEGIN
  IF NEW.external_effects_executed THEN
    RAISE EXCEPTION 'recovery commercial activation records cannot execute provider effects';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eos_recovery_agreement_authority_no_effect ON eos_recovery_agreement_authorities;
CREATE TRIGGER eos_recovery_agreement_authority_no_effect BEFORE INSERT OR UPDATE ON eos_recovery_agreement_authorities FOR EACH ROW EXECUTE FUNCTION eos_reject_recovery_activation_external_effect();
DROP TRIGGER IF EXISTS eos_recovery_agreement_instance_no_effect ON eos_recovery_agreement_instances;
CREATE TRIGGER eos_recovery_agreement_instance_no_effect BEFORE INSERT OR UPDATE ON eos_recovery_agreement_instances FOR EACH ROW EXECUTE FUNCTION eos_reject_recovery_activation_external_effect();
DROP TRIGGER IF EXISTS eos_recovery_billing_manifest_no_effect ON eos_recovery_billing_manifests;
CREATE TRIGGER eos_recovery_billing_manifest_no_effect BEFORE INSERT OR UPDATE ON eos_recovery_billing_manifests FOR EACH ROW EXECUTE FUNCTION eos_reject_recovery_activation_external_effect();
