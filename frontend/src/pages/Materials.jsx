import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Filter, Plus, FileText, Video, Link as LinkIcon, File } from 'lucide-react';

const getIconForType = (type) => {
  switch (type) {
    case 'slides': return <FileText size={16} />;
    case 'recording': return <Video size={16} />;
    case 'link': return <LinkIcon size={16} />;
    default: return <File size={16} />;
  }
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function Materials() {
  const { role } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [monthFilter, setMonthFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    session_id: '',
    title: '',
    type: 'slides',
    url: '',
    description: ''
  });

  const fetchData = async () => {
    setLoading(true);
    const { data: sData } = await supabase.from('sessions').select('*').order('date', { ascending: false });
    const { data: mData } = await supabase.from('materials').select('*').order('created_at', { ascending: false });
    
    setSessions(sData || []);
    setMaterials(mData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    // basic url validation
    if (!formData.url.startsWith('http')) {
      alert('URL must start with http:// or https://');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('materials').insert([formData]);
    
    setSaving(false);
    if (!error) {
      setShowModal(false);
      setFormData({ session_id: '', title: '', type: 'slides', url: '', description: '' });
      fetchData(); // refresh
    } else {
      alert("Error saving material");
    }
  };

  // Group materials by session
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      // Month filter
      if (monthFilter !== 'all' && s.month_number.toString() !== monthFilter) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const sessionMatch = s.topic.toLowerCase().includes(query);
        const sessionMats = materials.filter(m => m.session_id === s.id);
        const materialMatch = sessionMats.some(m => m.title.toLowerCase().includes(query) || (m.description && m.description.toLowerCase().includes(query)));
        
        if (!sessionMatch && !materialMatch) return false;
      }
      
      // Only show sessions that have materials OR if searching, match above
      const hasMaterials = materials.some(m => m.session_id === s.id);
      return hasMaterials;
    });
  }, [sessions, materials, monthFilter, searchQuery]);

  const uniqueMonths = [...new Set(sessions.map(s => s.month_number))].sort((a,b)=>a-b);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-h1">Class Materials</h1>
          <p className="text-body-lg text-fg-secondary">Access slides, recordings, and resources.</p>
        </div>
        {role === 'mentor' && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Material
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 card !rounded-2xl">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
          <input 
            type="text" 
            className="input !pl-9" 
            placeholder="Search topics or materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative w-48">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
          <select 
            className="input !pl-9 appearance-none"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="all">All Months</option>
            {uniqueMonths.map(m => (
              <option key={m} value={m}>Month {m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="card h-48 animate-pulse" />
          <div className="card h-48 animate-pulse" />
          <div className="card h-48 animate-pulse" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="card p-12 text-center flex flex-col items-center justify-center border-dashed">
          <BookOpen size={48} className="text-border-strong mb-4" strokeWidth={1} />
          <h3 className="text-h3 text-fg-primary mb-2">No materials found</h3>
          <p className="text-body text-fg-secondary">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSessions.map(session => {
            const sessionMaterials = materials.filter(m => m.session_id === session.id);
            return (
              <div key={session.id} className="card !p-6 flex flex-col">
                <p className="text-caption text-fg-tertiary mb-2 font-mono">{formatDate(session.date)}</p>
                <h3 className="text-h3 text-fg-primary mb-6">{session.topic}</h3>
                
                <div className="flex-1 space-y-3">
                  {sessionMaterials.map(mat => (
                    <a 
                      key={mat.id}
                      href={mat.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-3 p-3 rounded-lg bg-surface-inset border border-border-subtle hover:border-accent-glow hover:bg-surface-raised transition-all"
                    >
                      <div className="mt-0.5 text-accent-glow">
                        {getIconForType(mat.type)}
                      </div>
                      <div>
                        <p className="text-body font-medium text-fg-primary group-hover:text-accent-glow transition-colors">{mat.title}</p>
                        {mat.description && <p className="text-caption text-fg-secondary mt-1">{mat.description}</p>}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="modal-overlay z-50 flex items-center justify-center p-4">
          <div className="modal w-full max-w-lg">
            <h2 className="text-h2 mb-6 text-fg-primary">Add Material</h2>
            <form onSubmit={handleAddMaterial} className="space-y-4">
              <div>
                <label className="block text-label text-fg-secondary mb-2">SESSION</label>
                <select className="input bg-surface" required value={formData.session_id} onChange={e => setFormData({...formData, session_id: e.target.value})}>
                  <option value="" disabled>Select a session...</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{formatDate(s.date)} — {s.topic}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-label text-fg-secondary mb-2">TITLE</label>
                <input type="text" className="input" required placeholder="e.g. Slide Deck" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>

              <div className="flex gap-4">
                <div className="w-1/3">
                  <label className="block text-label text-fg-secondary mb-2">TYPE</label>
                  <select className="input bg-surface" required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="slides">Slides</option>
                    <option value="recording">Recording</option>
                    <option value="document">Document</option>
                    <option value="link">Link</option>
                  </select>
                </div>
                <div className="w-2/3">
                  <label className="block text-label text-fg-secondary mb-2">URL</label>
                  <input type="url" className="input" required placeholder="https://..." value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-label text-fg-secondary mb-2">DESCRIPTION (OPTIONAL)</label>
                <input type="text" className="input" placeholder="Brief notes..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Material'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { BookOpen } from 'lucide-react';
