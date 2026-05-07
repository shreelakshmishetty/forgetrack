import { useState } from 'react';
import StudentUpload from '../components/Upload/StudentUpload';
import AttendanceUpload from '../components/Upload/AttendanceUpload';
import { Users, CalendarCheck } from 'lucide-react';

export default function Upload() {
  const [activeTab, setActiveTab] = useState('students'); // 'students' or 'attendance'

  return (
    <div className="space-y-6">
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
      <div>
        {activeTab === 'students' && <StudentUpload />}
        {activeTab === 'attendance' && <AttendanceUpload />}
      </div>
    </div>
  );
}
