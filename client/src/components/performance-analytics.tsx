import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsOverview } from "./stats-overview";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";

type AnalyticsData = {
  agentPerformance: Array<{
    id: string;
    name: string;
    role: string;
    icon: string;
    tasksCompleted: number;
    tasksInProgress: number;
    tasksPending: number;
    completionRate: number;
    averageCompletionTime: number;
    tasksByPriority: {
      high: number;
      medium: number;
      low: number;
    };
  }>;
  taskCompletionTrends: Array<{
    date: string;
    created: number;
    completed: number;
  }>;
  taskDistributionByStatus: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  taskDistributionByType: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  taskDistributionByPriority: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  overallStats: {
    totalAgents: number;
    totalTasks: number;
    completionRate: number;
    averageTaskAge: number;
  };
};

export function PerformanceAnalytics() {
  const [timeRange, setTimeRange] = useState<"7days" | "30days" | "90days">("7days");
  
  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics", timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/analytics?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error("Failed to fetch analytics data");
      }
      return response.json();
    },
  });
  
  if (isLoading) {
    return <AnalyticsLoadingSkeleton />;
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-red-600">Error loading analytics</h3>
          <p className="text-sm text-gray-500">
            {error instanceof Error ? error.message : "An unknown error occurred"}
          </p>
        </div>
      </div>
    );
  }
  
  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-lg font-semibold">No analytics data available</h3>
          <p className="text-sm text-gray-500">
            Start creating agents and tasks to see analytics
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Performance Dashboard</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Time Period:</span>
          <Tabs 
            defaultValue={timeRange} 
            className="w-auto" 
            onValueChange={(value) => setTimeRange(value as "7days" | "30days" | "90days")}
          >
            <TabsList>
              <TabsTrigger value="7days">7 Days</TabsTrigger>
              <TabsTrigger value="30days">30 Days</TabsTrigger>
              <TabsTrigger value="90days">90 Days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      {/* Overall Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsOverview
          title="Active Agents"
          value={data.overallStats.totalAgents}
          description="Currently active agents"
          trend={{
            value: 0,
            isUpward: true,
            label: "compared to last period",
          }}
          icon="ri-robot-line"
        />
        <StatsOverview
          title="Total Tasks"
          value={data.overallStats.totalTasks}
          description="Tasks created"
          trend={{
            value: 0,
            isUpward: true,
            label: "compared to last period",
          }}
          icon="ri-task-line"
        />
        <StatsOverview
          title="Completion Rate"
          value={`${Math.round(data.overallStats.completionRate * 100)}%`}
          description="Tasks completed successfully"
          trend={{
            value: 0,
            isUpward: true,
            label: "compared to last period",
          }}
          icon="ri-check-double-line"
        />
        <StatsOverview
          title="Avg. Task Age"
          value={`${Math.round(data.overallStats.averageTaskAge)} days`}
          description="Average task lifetime"
          trend={{
            value: 0,
            isUpward: false,
            label: "compared to last period",
          }}
          icon="ri-timer-line"
        />
      </div>
      
      {/* Task Completion Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Task Completion Trends</CardTitle>
          <CardDescription>
            Track task creation and completion rates over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.taskCompletionTrends}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 30,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    });
                  }}
                  angle={-45}
                  textAnchor="end"
                  height={70}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="created"
                  name="Tasks Created"
                  stroke="#3b82f6"
                  activeDot={{ r: 8 }}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="Tasks Completed"
                  stroke="#22c55e"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      {/* Task Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Task Status Distribution</CardTitle>
            <CardDescription>Breakdown of tasks by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.taskDistributionByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.taskDistributionByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Tasks"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Task Type Distribution</CardTitle>
            <CardDescription>Breakdown of tasks by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.taskDistributionByType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.taskDistributionByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Tasks"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Task Priority Distribution</CardTitle>
            <CardDescription>Breakdown of tasks by priority</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.taskDistributionByPriority}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.taskDistributionByPriority.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Tasks"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Agent Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
          <CardDescription>
            Detailed performance metrics for each agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {data.agentPerformance.map((agent) => (
              <div key={agent.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${agent.role === 'executive' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <i className={`${agent.icon || 'ri-robot-line'} text-xl ${agent.role === 'executive' ? 'text-blue-600' : 'text-gray-600'}`}></i>
                  </div>
                  <div>
                    <h4 className="font-semibold">{agent.name}</h4>
                    <p className="text-sm text-gray-500 capitalize">{agent.role}</p>
                  </div>
                  <div className="ml-auto">
                    <span className="font-medium text-lg">{Math.round(agent.completionRate * 100)}%</span>
                    <p className="text-xs text-gray-500">Completion Rate</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Task Status</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs">Completed</span>
                      <span className="text-xs font-medium">{agent.tasksCompleted}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500" 
                        style={{ width: `${(agent.tasksCompleted / (agent.tasksCompleted + agent.tasksInProgress + agent.tasksPending || 1)) * 100}%` }}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between mb-2 mt-3">
                      <span className="text-xs">In Progress</span>
                      <span className="text-xs font-medium">{agent.tasksInProgress}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-500" 
                        style={{ width: `${(agent.tasksInProgress / (agent.tasksCompleted + agent.tasksInProgress + agent.tasksPending || 1)) * 100}%` }}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between mb-2 mt-3">
                      <span className="text-xs">Pending</span>
                      <span className="text-xs font-medium">{agent.tasksPending}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gray-500" 
                        style={{ width: `${(agent.tasksPending / (agent.tasksCompleted + agent.tasksInProgress + agent.tasksPending || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Priority Distribution</p>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs flex items-center">
                            <div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
                            High
                          </span>
                          <span className="text-xs font-medium">{agent.tasksByPriority.high}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-500" 
                            style={{ width: `${(agent.tasksByPriority.high / (agent.tasksByPriority.high + agent.tasksByPriority.medium + agent.tasksByPriority.low || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs flex items-center">
                            <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1"></div>
                            Medium
                          </span>
                          <span className="text-xs font-medium">{agent.tasksByPriority.medium}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-yellow-500" 
                            style={{ width: `${(agent.tasksByPriority.medium / (agent.tasksByPriority.high + agent.tasksByPriority.medium + agent.tasksByPriority.low || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs flex items-center">
                            <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
                            Low
                          </span>
                          <span className="text-xs font-medium">{agent.tasksByPriority.low}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500" 
                            style={{ width: `${(agent.tasksByPriority.low / (agent.tasksByPriority.high + agent.tasksByPriority.medium + agent.tasksByPriority.low || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Performance Metrics</p>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs mb-1">Average Completion Time</p>
                        <div className="flex items-center">
                          <span className="text-lg font-medium">
                            {agent.averageCompletionTime.toFixed(1)} hrs
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-xs mb-1">Tasks Completed</p>
                        <div className="flex items-center">
                          <span className="text-lg font-medium">
                            {agent.tasksCompleted}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(4).fill(0).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array(3).fill(0).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}