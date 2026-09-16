export type WorkflowRouteStep = {
  id?: unknown;
  actionKind?: unknown;
  onTrueStepId?: unknown;
  onFalseStepId?: unknown;
};

export class WorkflowRoutingError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

// Process versions are immutable, so the step list is the entire routing graph.
// EOS permits forward-only edges. This intentionally excludes loops, hidden
// retries, and a route that lands before the condition an operator just chose.
export function resolveWorkflowNextStep(
  steps: WorkflowRouteStep[],
  currentStep: number,
  conditionOutcome: boolean | undefined,
): number {
  const step = steps[currentStep] || {};
  const actionKind = String(step.actionKind || "manual");
  if (actionKind !== "condition") {
    if (conditionOutcome !== undefined)
      throw new WorkflowRoutingError("workflow_condition_outcome_invalid", "Only a condition step may select a conditional route.");
    return currentStep + 1;
  }

  const trueStepId = String(step.onTrueStepId || "").trim();
  const falseStepId = String(step.onFalseStepId || "").trim();
  // Older immutable process versions keep their prior linear behavior. A new
  // routed version must fail closed if its observed outcome was not recorded.
  if (!trueStepId && !falseStepId) {
    if (conditionOutcome !== undefined)
      throw new WorkflowRoutingError("workflow_condition_not_routed", "This legacy condition has no declared route. Create a routed process version before selecting an outcome.");
    return currentStep + 1;
  }
  if (conditionOutcome === undefined)
    throw new WorkflowRoutingError("workflow_condition_outcome_required", "Record whether the declared condition was met before EOS selects the next step.");
  const targetId = conditionOutcome ? trueStepId : falseStepId;
  const targetIndex = steps.findIndex((candidate) => String(candidate.id || "") === targetId);
  if (targetIndex <= currentStep)
    throw new WorkflowRoutingError("workflow_condition_route_invalid", "A condition route must lead to a later step in the immutable process version.");
  return targetIndex;
}
