import { useState } from 'react';
import StudentUpload from '../components/Upload/StudentUpload';
import AttendanceUpload from '../components/Upload/AttendanceUpload';
import { Users, CalendarCheck } from 'lucide-react';

export default function Upload() {
  const [activeTab, setActiveTab] = useState('students'); // 'students' or 'attendance'
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div 
      className={`space-y-6 min-h-[600px] transition-colors duration-300 ${isDragging ? 'bg-accent-glow/5' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Tab Navigation */}
      <div className="flex justify-center border-b border-border-subtle mb-8">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('students')}
            className={`pb-4 flex items-center gap-2 text-body-lg font-medium transition-colors border-b-2 ${
              activeTab === 'students' 
                ? 'border-accent-glow text-accent-glow' 
                : 'border-transparent text-fg-secondary hover:text-fg-primary hover:border-border-strong'
            }`}
          >
            <Users size={20} />
            Import Students
          </button>
          
          <button
            onClick={() => setActiveTab('attendance')}
            className={`pb-4 flex items-center gap-2 text-body-lg font-medium transition-colors border-b-2 ${
              activeTab === 'attendance' 
                ? 'border-accent-glow text-accent-glow' 
                : 'border-transparent text-fg-secondary hover:text-fg-primary hover:border-border-strong'
            }`}
          >
            <CalendarCheck size={20} />
            Import Attendance
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'students' && <StudentUpload />}
        {activeTab === 'attendance' && <AttendanceUpload />}
      </div>
    </div>
  );
}
