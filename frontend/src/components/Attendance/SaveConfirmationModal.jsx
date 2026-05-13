import { CheckCircle2, X } from 'lucide-react';
import { useEffect } from 'react';

export default function SaveConfirmationModal({ show, onClose }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-canvas/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm bg-surface border border-success-border rounded-2xl shadow-2xl p-8 text-center animate-in zoom-in-95 duration-300">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-surface-raised text-fg-tertiary transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="w-20 h-20 bg-success-bg/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-success-border/50">
          <CheckCircle2 size={44} className="text-success-fg animate-in zoom-in-50 duration-500 delay-150 fill-none" strokeWidth={2.5} />
        </div>
        
        <h2 className="text-h2 text-fg-primary mb-2">Success!</h2>
        <p className="text-body-lg text-fg-secondary">Attendance Saved Successfully</p>
        
        <div className="mt-8">
          <div className="h-1 w-full bg-surface-raised rounded-full overflow-hidden">
            <div className="h-full bg-success-fg animate-shrink-width" style={{ animationDuration: '3000ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
