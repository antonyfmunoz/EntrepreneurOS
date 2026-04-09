# Feature Specification

Feature Name:
Agent Creation System

Problem:
Users need to create AI agents that perform business tasks.

User Story:
As a founder I want to create an AI agent with a role and instructions.

Entities involved:
agents
users

Database changes:
agents table

API endpoints:

POST /api/agents
GET /api/agents
DELETE /api/agents/:id

Frontend pages:

/agents

UI components:

Agent creation form
Agent list
Agent card

Permissions:

Only company owner can create agents.

Success criteria:

User can create agent
Agent appears on dashboard
Agent persists in database