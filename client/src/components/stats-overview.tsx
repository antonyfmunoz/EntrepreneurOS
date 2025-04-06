import { useQuery } from "@tanstack/react-query";

type StatCard = {
  title: string;
  value: number;
  change: number;
  changeText: string;
  icon: string;
  iconBgColor: string;
  iconColor: string;
};

export function StatsOverview() {
  const { data: stats } = useQuery<{
    activeAgents: StatCard;
    tasksCompleted: StatCard;
    activeTasks: StatCard;
  }>({
    queryKey: ["/api/stats"],
  });

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-4 border border-gray-200 animate-pulse">
            <div className="h-16"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <StatCard 
        title="Active Agents"
        value={stats.activeAgents.value}
        change={stats.activeAgents.change}
        changeText={stats.activeAgents.changeText}
        icon="ri-robot-line"
        iconBgColor="bg-blue-100"
        iconColor="text-primary"
      />
      
      <StatCard 
        title="Tasks Completed"
        value={stats.tasksCompleted.value}
        change={stats.tasksCompleted.change}
        changeText={stats.tasksCompleted.changeText}
        icon="ri-check-double-line"
        iconBgColor="bg-green-100"
        iconColor="text-success"
      />
      
      <StatCard 
        title="Active Tasks"
        value={stats.activeTasks.value}
        change={stats.activeTasks.change}
        changeText={stats.activeTasks.changeText}
        icon="ri-time-line"
        iconBgColor="bg-indigo-100"
        iconColor="text-secondary"
      />
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  change, 
  changeText, 
  icon, 
  iconBgColor, 
  iconColor 
}: StatCard) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full ${iconBgColor} flex items-center justify-center ${iconColor}`}>
          <i className={`${icon} text-xl`}></i>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        <span className={change >= 0 ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
          {change >= 0 ? "↑" : "↓"} {changeText}
        </span> from last week
      </div>
    </div>
  );
}
