import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { TaskBoard } from "@/components/task-board";

export default function TaskBoardPage() {
  return (
    <div className="bg-gray-50 h-screen flex overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header title="Task Board" />
        
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          <TaskBoard />
        </div>
      </div>
    </div>
  );
}
