import { storage } from '../storage';
import { sendEmail } from '../integrations/gmail';
import type { AgentAction } from '@shared/schema';

const TIME_ESTIMATES: Record<string, number> = {
  send_email: 5,
  create_document: 15,
  calendar_event: 10,
  schedule_meeting: 10,
  research: 30,
  default: 5,
};

export async function executeAction(action: AgentAction): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  await storage.updateAction(action.id, {
    status: 'executing',
    updatedAt: new Date(),
  });

  try {
    let result: { success: boolean; result?: any; error?: string };

    switch (action.actionType) {
      case 'send_email':
        result = await executeSendEmail(action);
        break;
      case 'create_document':
        result = await executeCreateDocument(action);
        break;
      default:
        result = { success: false, error: `Unknown action type: ${action.actionType}` };
    }

    if (result.success) {
      await storage.updateAction(action.id, {
        status: 'completed',
        result: result.result,
        executedAt: new Date(),
        updatedAt: new Date(),
      });

      await updateMetrics(action.agentId, action.userId, {
        actionsExecuted: 1,
        timeSavedMinutes: TIME_ESTIMATES[action.actionType] || TIME_ESTIMATES.default,
      });
    } else {
      await storage.updateAction(action.id, {
        status: 'failed',
        errorMessage: result.error,
        updatedAt: new Date(),
      });
    }

    return result;
  } catch (error: any) {
    const errorMsg = error.message || 'Unexpected execution error';
    await storage.updateAction(action.id, {
      status: 'failed',
      errorMessage: errorMsg,
      updatedAt: new Date(),
    });
    return { success: false, error: errorMsg };
  }
}

async function executeSendEmail(action: AgentAction): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  const params = action.parameters as Record<string, any>;
  const { to, subject, body, cc, bcc } = params;

  if (!to || !subject || !body) {
    return { success: false, error: 'Missing required email fields: to, subject, body' };
  }

  const emailResult = await sendEmail(action.userId, { to, subject, body, cc, bcc });

  if (emailResult.success) {
    return { success: true, result: { messageId: emailResult.messageId, sentTo: to } };
  }

  return { success: false, error: emailResult.error };
}

async function executeCreateDocument(action: AgentAction): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  const params = action.parameters as Record<string, any>;
  const { title, content } = params;

  if (!title || !content) {
    return { success: false, error: 'Missing required document fields: title, content' };
  }

  try {
    const document = await storage.createDocument({
      title,
      content,
      userId: action.userId,
      tags: params.tags || [],
    });
    return { success: true, result: { documentId: document.id, title: document.title } };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create document' };
  }
}

async function updateMetrics(
  agentId: string,
  userId: string,
  updates: { actionsExecuted?: number; timeSavedMinutes?: number; tasksCompleted?: number }
) {
  const today = new Date().toISOString().split('T')[0];

  try {
    await storage.upsertAgentMetric({
      agentId,
      userId,
      date: today,
      actionsExecuted: updates.actionsExecuted || 0,
      timeSavedMinutes: updates.timeSavedMinutes || 0,
      tasksCompleted: updates.tasksCompleted || 0,
      messagesSent: 0,
      apiCost: 0,
    });
  } catch (error) {
    console.error('Error updating metrics:', error);
  }
}
