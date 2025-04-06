import { useLocation } from "wouter";

type HeaderProps = {
  title: string;
};

export function Header({ title }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6">
      <h1 className="text-xl font-bold text-gray-800">{title}</h1>
      <div className="ml-auto flex items-center space-x-4">
        <button className="text-gray-500 hover:text-gray-700 p-2">
          <i className="ri-notification-3-line"></i>
        </button>
        <button className="text-gray-500 hover:text-gray-700 p-2">
          <i className="ri-question-line"></i>
        </button>
      </div>
    </header>
  );
}
