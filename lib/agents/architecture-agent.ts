// lib/agents/architecture-agent.ts
// Architecture agent — designs complete system architecture from a ProjectBrief
// and ProductInsights. Outputs a SystemArchitecture artifact consumed by
// downstream agents (design-system, backend, page-builder, etc.).

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, getAnthropicBaseUrl } from "../env.js";
import { extractJsonFromResponse } from "../spec-parser/restructure-spec.js";
import { ArtifactStore } from "./artifact-store.js";
import type { SystemArchitecture, ProductInsights } from "./types.js";
import type { ProjectBrief } from "../intake/types.js";

const SYSTEM_PROMPT = `You are a senior full-stack architect with deep expertise in React, TypeScript, Express, PostgreSQL, and Drizzle ORM. You design complete, production-ready system architectures for SaaS applications.

Given a product brief and strategic insights, you produce a SystemArchitecture JSON object that downstream agents consume to build the entire application. Your output must be precise, complete, and directly implementable.

RESPONSE FORMAT: Return ONLY a valid JSON object matching the schema below — no preamble, no markdown fences, no explanation.

JSON SCHEMA:
{
  "dataModel": {
    "entities": [
      {
        "tableName": "string (snake_case, plural, e.g. users)",
        "fields": [
          {
            "name": "string (snake_case field name)",
            "type": "string (Drizzle/PG type: text, integer, boolean, timestamp, serial, uuid, jsonb, etc.)",
            "nullable": false,
            "defaultValue": "optional string (e.g. 'now()', 'true', '0')",
            "references": { "table": "string", "column": "string" }
          }
        ],
        "indexes": ["string (index description, e.g. 'unique on email', 'btree on created_at')"],
        "timestamps": true
      }
    ],
    "relationships": [
      {
        "from": "string (table name)",
        "to": "string (table name)",
        "type": "one-to-one | one-to-many | many-to-many",
        "foreignKey": "string (column name holding the FK)"
      }
    ],
    "enums": [
      { "name": "string (PascalCase enum name)", "values": ["string"] }
    ]
  },
  "apiContracts": [
    {
      "method": "GET | POST | PUT | PATCH | DELETE",
      "path": "string (starts with /api/)",
      "description": "string",
      "authRequired": true,
      "requestBody": { "fieldName": "type description" },
      "responseShape": { "fieldName": "type description" },
      "validationRules": ["string"],
      "relatedEntity": "string (table name)",
      "pageRef": "optional string (route of the page that uses this endpoint)"
    }
  ],
  "pages": [
    {
      "name": "string (PascalCase page name)",
      "route": "string (starts with /)",
      "authLevel": "public | authenticated | admin",
      "purpose": "string",
      "components": ["string (component names used on this page)"],
      "dataNeeds": ["string (API endpoints or data descriptions this page needs)"],
      "mutations": ["string (API endpoints this page writes to)"],
      "layoutHint": "optional string (e.g. sidebar-main, centered, full-width)",
      "emptyState": "optional string (what to show when no data)",
      "errorState": "optional string (what to show on error)"
    }
  ],
  "componentHierarchy": [
    {
      "name": "string (PascalCase component name)",
      "purpose": "string",
      "props": [
        { "name": "string", "type": "string (TypeScript type)", "optional": false }
      ],
      "usedByPages": ["string (page names)"],
      "dependsOn": ["string (other component names)"]
    }
  ],
  "userFlows": [
    {
      "name": "string (flow name, e.g. 'User Registration')",
      "steps": ["string (each step in the flow)"]
    }
  ]
}

DESIGN RULES:
1. Every page in the spec MUST appear in the pages array with correct routes, auth levels, and data needs.
2. Every API endpoint referenced by a page MUST exist in apiContracts.
3. Every entity referenced by an API contract MUST exist in dataModel.entities.
4. Shared UI elements (nav, sidebar, modals, form components) MUST appear in componentHierarchy.
5. Include id (serial primary key) and timestamp fields (created_at, updated_at) on every entity — set timestamps: true.
6. Foreign keys MUST reference existing entities and appear in relationships.
7. Include proper indexes for foreign keys, unique constraints, and frequently queried fields.
8. Auth-related entities (users, sessions) are always included if any page requires authentication.
9. Enums should be used for any field with a fixed set of values (status, role, type fields).
10. User flows should cover the critical paths: registration, core feature usage, and key admin actions.

Return ONLY the JSON object.`;

function buildUserPrompt(brief: ProjectBrief, insights: ProductInsights): string {
  const specPages = brief.spec.pages
    .map(
      (p) =>
        `  - ${p.name} (${p.route}) [auth: ${p.authLevel}, priority: ${p.priority}]\n` +
        `    Purpose: ${p.purpose}\n` +
        `    Components: ${p.components.join(", ")}\n` +
        `    Data: ${(p.dataRequirements ?? []).map((d) => `${d.component}(${d.fields.join(", ")})`).join("; ") || "none"}\n` +
        `    API: ${(p.apiEndpoints ?? []).map((e) => e.endpoint).join(", ") || "none"}\n` +
        `    Events: ${(p.events ?? []).map((e) => e.name).join(", ") || "none"}`,
    )
    .join("\n");

  const specEndpoints = (brief.spec.backendSpec?.endpoints ?? [])
    .map(
      (e) =>
        `  - ${e.method} ${e.path}: ${e.description} [auth: ${e.authRequired}, page: ${e.uiPageRef ?? "n/a"}]`,
    )
    .join("\n");

  const sharedComponents = (brief.spec.sharedComponents ?? [])
    .map((c) => `  - ${c.name}: ${c.purpose} (used by: ${c.usedByPages.join(", ")})`)
    .join("\n");

  const drizzleHints = (brief.spec.backendSpec?.drizzleTableHints ?? []).join(", ");

  return `Design the complete system architecture for the following SaaS product.

PRODUCT BRIEF:
- Name: ${brief.productName}
- Description: ${brief.productDescription}
- Vision: ${brief.productVision || "not specified"}
- Target Users: ${brief.targetUsers.join(", ") || "not specified"}
- Jobs to Be Done: ${brief.jobsToBeDone.join("; ") || "not specified"}
- Auth Provider: ${brief.authProvider}
- DB Provider: ${brief.dbProvider}
- Tech Stack: ${brief.techStack.frontend} + ${brief.techStack.buildTool} + ${brief.techStack.styling} + ${brief.techStack.componentLib}

SPEC PAGES:
${specPages}

BACKEND SPEC ENDPOINTS:
${specEndpoints || "  (none specified — infer from pages)"}

SHARED COMPONENTS:
${sharedComponents || "  (none specified — infer from pages)"}

DATABASE TABLE HINTS: ${drizzleHints || "none — infer from data requirements"}

PRODUCT INSIGHTS:
- Category: ${insights.productCategory}
- Target Profile: ${insights.targetUserProfile}
- Market Positioning: ${insights.marketPositioning}
- Architecture Recommendations:
${insights.architectureRecommendations.map((r) => `  - ${r}`).join("\n")}
- Design Recommendations:
${insights.designRecommendations.map((r) => `  - ${r}`).join("\n")}

Return the SystemArchitecture JSON object now.`;
}

export async function runArchitectureAgent(
  brief: ProjectBrief,
  insights: ProductInsights,
  store: ArtifactStore,
): Promise<SystemArchitecture> {
  const client = new Anthropic({
    apiKey: getAnthropicApiKey(),
    baseURL: getAnthropicBaseUrl(),
  });

  const userPrompt = buildUserPrompt(brief, insights);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  // First attempt
  const stream = client.messages.stream({
    model: "claude-sonnet-4-5",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages,
  });
  const finalMessage = await stream.finalMessage();
  const firstContent = finalMessage.content[0];
  if (!firstContent || firstContent.type !== "text") {
    throw new Error("Architecture agent received unexpected response type from Anthropic API");
  }

  let architecture: SystemArchitecture;

  try {
    architecture = extractJsonFromResponse(firstContent.text) as SystemArchitecture;
    validateArchitecture(architecture);
  } catch (firstError) {
    // Retry once with error context
    const retryMessages: Anthropic.MessageParam[] = [
      { role: "user", content: userPrompt },
      { role: "assistant", content: firstContent.text },
      {
        role: "user",
        content:
          `Your previous response failed to parse or validate. Error:\n\n${String(firstError)}\n\n` +
          `Return a corrected SystemArchitecture JSON object. Return ONLY the JSON — no explanation.`,
      },
    ];

    const retryStream = client.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: retryMessages,
    });
    const retryMessage = await retryStream.finalMessage();
    const retryContent = retryMessage.content[0];
    if (!retryContent || retryContent.type !== "text") {
      throw new Error("Architecture agent retry received unexpected response type");
    }

    architecture = extractJsonFromResponse(retryContent.text) as SystemArchitecture;
    validateArchitecture(architecture);
  }

  store.setArchitecture(architecture);

  return architecture;
}

/**
 * Lightweight structural validation to catch obvious shape mismatches
 * before the architecture propagates to downstream agents.
 */
function validateArchitecture(arch: SystemArchitecture): void {
  if (!arch.dataModel || !Array.isArray(arch.dataModel.entities)) {
    throw new Error("Missing or invalid dataModel.entities");
  }
  if (!Array.isArray(arch.dataModel.relationships)) {
    throw new Error("Missing or invalid dataModel.relationships");
  }
  if (!Array.isArray(arch.dataModel.enums)) {
    throw new Error("Missing or invalid dataModel.enums");
  }
  if (!Array.isArray(arch.apiContracts)) {
    throw new Error("Missing or invalid apiContracts");
  }
  if (!Array.isArray(arch.pages)) {
    throw new Error("Missing or invalid pages");
  }
  if (!Array.isArray(arch.componentHierarchy)) {
    throw new Error("Missing or invalid componentHierarchy");
  }
  if (!Array.isArray(arch.userFlows)) {
    throw new Error("Missing or invalid userFlows");
  }

  for (const entity of arch.dataModel.entities) {
    if (!entity.tableName || !Array.isArray(entity.fields)) {
      throw new Error(`Invalid entity: missing tableName or fields`);
    }
    for (const field of entity.fields) {
      if (!field.name || !field.type || typeof field.nullable !== "boolean") {
        throw new Error(
          `Invalid field in entity "${entity.tableName}": each field needs name, type, and nullable`,
        );
      }
    }
  }

  for (const contract of arch.apiContracts) {
    if (!contract.method || !contract.path || !contract.description) {
      throw new Error(`Invalid API contract: missing method, path, or description`);
    }
  }

  for (const page of arch.pages) {
    if (!page.name || !page.route || !page.authLevel) {
      throw new Error(`Invalid page: missing name, route, or authLevel`);
    }
  }

  for (const component of arch.componentHierarchy) {
    if (!component.name || !Array.isArray(component.props)) {
      throw new Error(`Invalid component: missing name or props array`);
    }
  }

  for (const flow of arch.userFlows) {
    if (!flow.name || !Array.isArray(flow.steps)) {
      throw new Error(`Invalid user flow: missing name or steps array`);
    }
  }
}
