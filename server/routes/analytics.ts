import { Express } from "express";
import { storage } from "../storage";

export function registerAnalyticsRoutes(app: Express): void {
  // Stats API
  app.get("/api/stats", async (_req, res) => {
    const agents = await storage.getAgents();
    const tasks = await storage.getTasks();

    const activeAgents = agents.length;
    const tasksCompleted = tasks.filter(task => task.status === "done").length;
    const activeTasks = tasks.filter(task => task.status !== "done").length;

    res.json({
      activeAgents: {
        title: "Active Agents",
        value: activeAgents,
        change: 1,
        changeText: "1 agent",
        icon: "ri-robot-line",
        iconBgColor: "bg-blue-100",
        iconColor: "text-primary",
      },
      tasksCompleted: {
        title: "Tasks Completed",
        value: tasksCompleted,
        change: 12,
        changeText: "12 tasks",
        icon: "ri-check-double-line",
        iconBgColor: "bg-green-100",
        iconColor: "text-success",
      },
      activeTasks: {
        title: "Active Tasks",
        value: activeTasks,
        change: -2,
        changeText: "2 tasks",
        icon: "ri-time-line",
        iconBgColor: "bg-indigo-100",
        iconColor: "text-secondary",
      },
    });
  });

  // Enhanced Analytics API
  app.get("/api/analytics", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const timeRange = req.query.timeRange as string || '7days';
      const showComparison = req.query.showComparison === 'true';
      const agents = await storage.getAgents();
      const tasks = await storage.getTasks();
      const allMessages = await storage.getAllMessages();

      // Calculate date range based on timeRange
      const now = new Date();
      const startDate = new Date();
      let daysToGenerate = 7;
      let comparisonLabel = 'vs previous week';

      if (timeRange === '7days') {
        startDate.setDate(now.getDate() - 7);
        daysToGenerate = 7;
        comparisonLabel = 'vs previous week';
      } else if (timeRange === '30days') {
        startDate.setDate(now.getDate() - 30);
        daysToGenerate = 30;
        comparisonLabel = 'vs previous month';
      } else if (timeRange === '90days') {
        startDate.setDate(now.getDate() - 90);
        daysToGenerate = 90;
        comparisonLabel = 'vs previous quarter';
      } else if (timeRange === '365days') {
        startDate.setDate(now.getDate() - 365);
        daysToGenerate = 365;
        comparisonLabel = 'vs previous year';
      }

      // Calculate start and end dates for previous period
      const previousPeriodEnd = new Date(startDate);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);

      const previousPeriodStart = new Date(previousPeriodEnd);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - daysToGenerate);

      // Filter data within the selected time range
      const tasksInRange = tasks.filter(task => {
        if (!task.createdAt) return false;
        const createdDate = new Date(task.createdAt);
        return createdDate >= startDate && createdDate <= now;
      });

      const messagesInRange = allMessages.filter(message => {
        if (!message.timestamp) return false;
        const timestamp = new Date(message.timestamp);
        return timestamp >= startDate && timestamp <= now;
      });

      // Agent activity metrics
      const agentActivity: Record<string, number> = {};
      messagesInRange.forEach(message => {
        if (!message.agentId) return;
        agentActivity[message.agentId] = (agentActivity[message.agentId] || 0) + 1;
      });

      // Agent performance metrics
      const agentPerformance = agents.map(agent => {
        const agentTasks = tasksInRange.filter(task => task.agentId === agent.id);
        const completedTasks = agentTasks.filter(task => task.status === 'done');
        const inProgressTasks = agentTasks.filter(task => task.status === 'in-progress');
        const pendingTasks = agentTasks.filter(task => task.status === 'todo');

        // Calculate completion rate with actual data
        const completionRate = agentTasks.length > 0 ? completedTasks.length / agentTasks.length : 0;

        // Calculate accurate average completion time for completed tasks
        const averageCompletionTime =
          completedTasks.length > 0 ?
          completedTasks.reduce((sum, task) => {
            // Safely parse dates with fallbacks
            const createdDate = typeof task.createdAt === 'string' ? new Date(task.createdAt) : new Date();
            const updatedDate = typeof task.updatedAt === 'string' ? new Date(task.updatedAt) : new Date();
            const hoursDiff = Math.max(0, (updatedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60));
            return sum + hoursDiff;
          }, 0) / completedTasks.length : 0;

        // Count tasks by priority with proper fallbacks
        const highPriorityTasks = agentTasks.filter(task => task.priority === 'high').length;
        const mediumPriorityTasks = agentTasks.filter(task => task.priority === 'medium').length;
        const lowPriorityTasks = agentTasks.filter(task => task.priority === 'low' || !task.priority).length;

        // Calculate message activity
        const messageCount = agentActivity[agent.id] || 0;

        return {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          icon: agent.icon,
          tasksCompleted: completedTasks.length,
          tasksInProgress: inProgressTasks.length,
          tasksPending: pendingTasks.length,
          totalTasks: agentTasks.length,
          messageCount,
          activityScore: messageCount + (completedTasks.length * 3),
          completionRate,
          averageCompletionTime: parseFloat(averageCompletionTime.toFixed(2)),
          tasksByPriority: {
            high: highPriorityTasks,
            medium: mediumPriorityTasks,
            low: lowPriorityTasks
          }
        };
      });

      // Sort agents by activity score for more meaningful display
      agentPerformance.sort((a, b) => b.activityScore - a.activityScore);

      // Generate accurate task completion trends with real data
      const taskCompletionTrends = [];

      for (let i = 0; i < daysToGenerate; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (daysToGenerate - i - 1));
        const dateStr = date.toISOString().split('T')[0];
        const dateCopy = new Date(date);
        dateCopy.setHours(23, 59, 59, 999); // End of the day

        // Filter tasks created on this date
        const tasksCreatedOnDate = tasks.filter(task => {
          if (!task.createdAt) return false;
          const createdDate = new Date(task.createdAt);
          return createdDate.toISOString().split('T')[0] === dateStr;
        }).length;

        // Filter tasks completed on this date
        const tasksCompletedOnDate = tasks.filter(task => {
          if (task.status !== 'done' || !task.updatedAt) return false;
          const updatedDate = new Date(task.updatedAt);
          return updatedDate.toISOString().split('T')[0] === dateStr;
        }).length;

        taskCompletionTrends.push({
          date: dateStr,
          created: tasksCreatedOnDate,
          completed: tasksCompletedOnDate
        });
      }

      // Task distribution by status with accurate counts
      const todoCount = tasks.filter(task => task.status === 'todo').length;
      const inProgressCount = tasks.filter(task => task.status === 'in-progress').length;
      const doneCount = tasks.filter(task => task.status === 'done').length;

      const taskDistributionByStatus = [
        {
          name: "Completed",
          value: doneCount,
          color: "#22c55e" // green-500
        },
        {
          name: "In Progress",
          value: inProgressCount,
          color: "#f59e0b" // yellow-500
        },
        {
          name: "To Do",
          value: todoCount,
          color: "#6b7280" // gray-500
        }
      ].filter(item => item.value > 0); // Only include non-zero values

      // Get accurate task types from actual data
      const taskTypes = Array.from(new Set(tasks.map(task => task.taskType || 'standard')));

      // Task distribution by type
      const taskDistributionByType = taskTypes.map(type => {
        const count = tasks.filter(task => (task.taskType || 'standard') === type).length;
        const colors: Record<string, string> = {
          'standard': "#3b82f6", // blue-500
          'collaboration': "#8b5cf6", // violet-500
          'delegated': "#ec4899", // pink-500
          'subtask': "#14b8a6", // teal-500
          'default': "#64748b" // slate-500
        };

        return {
          name: type.charAt(0).toUpperCase() + type.slice(1),
          value: count,
          color: colors[type as keyof typeof colors] || colors['default']
        };
      }).filter(item => item.value > 0); // Only include non-zero values

      // Task distribution by priority with accurate counts
      const highCount = tasks.filter(task => task.priority === 'high').length;
      const mediumCount = tasks.filter(task => task.priority === 'medium').length;
      const lowCount = tasks.filter(task => task.priority === 'low' || !task.priority).length;

      const taskDistributionByPriority = [
        {
          name: "High",
          value: highCount,
          color: "#ef4444" // red-500
        },
        {
          name: "Medium",
          value: mediumCount,
          color: "#f59e0b" // yellow-500
        },
        {
          name: "Low",
          value: lowCount,
          color: "#10b981" // emerald-500
        }
      ].filter(item => item.value > 0); // Only include non-zero values

      // Calculate overall stats with accurate data
      const totalAgents = agents.length;
      const totalTasks = tasks.length;
      const completedTasksCount = tasks.filter(task => task.status === 'done').length;
      const completionRate = totalTasks > 0 ? completedTasksCount / totalTasks : 0;

      // Calculate accurate average task age in days
      const averageTaskAge = tasks.length > 0 ?
        tasks.reduce((sum, task) => {
          if (!task.createdAt) return sum;
          const createdDate = new Date(task.createdAt);
          const ageInDays = Math.max(0, (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          return sum + ageInDays;
        }, 0) / tasks.length : 0;

      // Additional KPIs
      const totalMessages = allMessages.length;
      const averageTasksPerAgent = totalAgents > 0 ? totalTasks / totalAgents : 0;
      const messagesPerDay = daysToGenerate > 0 ? messagesInRange.length / daysToGenerate : 0;
      const tasksPerDay = daysToGenerate > 0 ? tasksInRange.length / daysToGenerate : 0;

      // Previous period data calculation
      const previousPeriodTasks = tasks.filter(task => {
        if (!task.createdAt) return false;
        const createdDate = new Date(task.createdAt);
        return createdDate >= previousPeriodStart && createdDate <= previousPeriodEnd;
      });

      const previousPeriodMessages = allMessages.filter(message => {
        if (!message.timestamp) return false;
        const timestamp = new Date(message.timestamp);
        return timestamp >= previousPeriodStart && timestamp <= previousPeriodEnd;
      });

      // Calculate task growth rate
      const taskGrowthRate = previousPeriodTasks.length > 0 ?
        ((tasksInRange.length - previousPeriodTasks.length) / previousPeriodTasks.length) : 0;

      // Calculate completion rate change (if comparison is active)
      const previousPeriodCompletedTasks = previousPeriodTasks.filter(task => task.status === 'done').length;
      const previousCompletionRate = previousPeriodTasks.length > 0 ?
        previousPeriodCompletedTasks / previousPeriodTasks.length : 0;
      const completionRateChange = completionRate - previousCompletionRate;

      // Only include previous period data if comparison is enabled
      const responseData: any = {
        agentPerformance,
        taskCompletionTrends,
        taskDistributionByStatus,
        taskDistributionByType,
        taskDistributionByPriority,
        overallStats: {
          totalAgents,
          totalTasks,
          completedTasks: completedTasksCount,
          totalMessages,
          averageTasksPerAgent: parseFloat(averageTasksPerAgent.toFixed(1)),
          messagesPerDay: parseFloat(messagesPerDay.toFixed(1)),
          tasksPerDay: parseFloat(tasksPerDay.toFixed(1)),
          completionRate: parseFloat(completionRate.toFixed(2)),
          averageTaskAge: parseFloat(averageTaskAge.toFixed(1)),
          taskGrowthRate: parseFloat(taskGrowthRate.toFixed(2))
        }
      };

      // Include comparison data if requested
      if (showComparison) {
        // Previous period task distributions
        const prevPeriodTodoCount = previousPeriodTasks.filter(task => task.status === 'todo').length;
        const prevPeriodInProgressCount = previousPeriodTasks.filter(task => task.status === 'in-progress').length;
        const prevPeriodDoneCount = previousPeriodTasks.filter(task => task.status === 'done').length;

        const prevTaskDistributionByStatus = [
          {
            name: "Completed",
            value: prevPeriodDoneCount,
            color: "#22c55e" // green-500
          },
          {
            name: "In Progress",
            value: prevPeriodInProgressCount,
            color: "#f59e0b" // yellow-500
          },
          {
            name: "To Do",
            value: prevPeriodTodoCount,
            color: "#6b7280" // gray-500
          }
        ].filter(item => item.value > 0);

        // Add previous period data to response
        responseData.previousPeriod = {
          timeLabel: comparisonLabel,
          startDate: previousPeriodStart.toISOString(),
          endDate: previousPeriodEnd.toISOString(),
          taskCount: previousPeriodTasks.length,
          completedTasksCount: previousPeriodCompletedTasks,
          messageCount: previousPeriodMessages.length,
          completionRate: parseFloat(previousCompletionRate.toFixed(2)),
          taskDistributionByStatus: prevTaskDistributionByStatus
        };

        responseData.comparisons = {
          taskCountChange: tasksInRange.length - previousPeriodTasks.length,
          taskCountChangePercent: previousPeriodTasks.length > 0 ?
            parseFloat(((tasksInRange.length - previousPeriodTasks.length) / previousPeriodTasks.length * 100).toFixed(1)) : 0,
          completedTasksChange: completedTasksCount - previousPeriodCompletedTasks,
          completionRateChange: parseFloat(completionRateChange.toFixed(2)),
          messageCountChange: messagesInRange.length - previousPeriodMessages.length
        };
      }

      res.json(responseData);
    } catch (error) {
      console.error("Error generating analytics:", error);
      res.status(500).json({
        message: "Failed to generate analytics",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
