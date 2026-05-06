import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, MapPin, Type, FileText, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface BookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: string;
}

const EVENT_TYPES = ['Wedding', 'DJ', 'Holi', 'Corporate', 'College Fest'];

export function BookingForm({ isOpen, onClose, initialType }: BookingFormProps) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    type: initialType || 'Corporate'
  });
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Save to Firestore
      await addDoc(collection(db, 'submissions'), {
        ...formData,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // 2. Generate Image
      const imageUrl = await geminiService.generateEventImage(formData.type);
      setGeneratedImage(imageUrl);
      
      setStep('success');
    } catch (error) {
      console.error("Submission error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-editorial-bg/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-editorial-card border border-editorial-border shadow-2xl overflow-hidden rounded-none flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-8 border-b border-editorial-border flex justify-between items-center bg-editorial-text/[0.02]">
              <div>
                <h2 className="serif text-3xl italic text-editorial-text uppercase tracking-tight">
                  {step === 'form' ? 'Initialize_Mandate' : 'Sequence_Finalized'}
                </h2>
                <p className="font-mono text-[9px] font-black uppercase tracking-[0.4em] text-editorial-accent/60 mt-2">
                  {formData.type || 'SYSTEM_MANDATE'} // {new Date().getFullYear()}
                </p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-editorial-text/5 rounded-full transition-colors text-editorial-text/40 hover:text-editorial-accent"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10">
              {step === 'form' ? (
                <form onSubmit={handleSubmit} className="space-y-10">
                  <div className="grid md:grid-cols-2 gap-10">
                    {/* Title */}
                    <div className="space-y-4">
                      <label className="font-mono text-[8px] font-black uppercase tracking-[0.5em] text-editorial-text/30 flex items-center gap-3">
                        <Type size={10} /> TITLE_ENTRY
                      </label>
                      <input
                        required
                        type="text"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Archived Collection Title..."
                        className="w-full bg-editorial-text/[0.02] border border-editorial-border p-4 font-sans text-xs italic text-editorial-text focus:outline-none focus:border-editorial-accent transition-all"
                      />
                    </div>

                    {/* Type */}
                    <div className="space-y-4">
                      <label className="font-mono text-[8px] font-black uppercase tracking-[0.5em] text-editorial-text/30 flex items-center gap-3">
                        <Sparkles size={10} /> CATEGORY_SELECT
                      </label>
                      <select
                        value={formData.type}
                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                        className="w-full bg-editorial-text/[0.02] border border-editorial-border p-4 font-sans text-xs italic text-editorial-text focus:outline-none focus:border-editorial-accent transition-all appearance-none"
                      >
                        {EVENT_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                      </select>
                    </div>

                    {/* Date */}
                    <div className="space-y-4">
                      <label className="font-mono text-[8px] font-black uppercase tracking-[0.5em] text-editorial-text/30 flex items-center gap-3">
                        <Calendar size={10} /> TEMPORAL_LOCK
                      </label>
                      <input
                        required
                        type="date"
                        value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        className="w-full bg-editorial-text/[0.02] border border-editorial-border p-4 font-sans text-xs text-editorial-text focus:outline-none focus:border-editorial-accent transition-all"
                      />
                    </div>

                    {/* Location */}
                    <div className="space-y-4">
                      <label className="font-mono text-[8px] font-black uppercase tracking-[0.5em] text-editorial-text/30 flex items-center gap-3">
                        <MapPin size={10} /> SPATIAL_COORDS
                      </label>
                      <input
                        required
                        type="text"
                        value={formData.location}
                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Global Coordinates..."
                        className="w-full bg-editorial-text/[0.02] border border-editorial-border p-4 font-sans text-xs italic text-editorial-text focus:outline-none focus:border-editorial-accent transition-all"
                      />
                    </div>

                    {/* Description */}
                    <div className="col-span-full space-y-4">
                      <label className="font-mono text-[8px] font-black uppercase tracking-[0.5em] text-editorial-text/30 flex items-center gap-3">
                        <FileText size={10} /> NARRATIVE_BUFFER
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Detailed tactical objective..."
                        className="w-full bg-editorial-text/[0.02] border border-editorial-border p-4 font-sans text-xs italic text-editorial-text focus:outline-none focus:border-editorial-accent transition-all resize-none"
                      />
                    </div>
                  </div>

                  <button
                    disabled={loading}
                    type="submit"
                    className="w-full group relative overflow-hidden bg-editorial-text text-editorial-bg py-6 font-mono text-[10px] font-black uppercase tracking-[0.6em] transition-all hover:bg-editorial-accent"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-4">
                        <Loader2 className="animate-spin" size={12} /> INITIALIZING_PROTOCOL...
                      </span>
                    ) : (
                      'EXECUTE_SUBMISSION'
                    )}
                  </button>
                </form>
              ) : (
                <div className="space-y-12 text-center py-10">
                  <div className="flex flex-col items-center gap-6">
                    <CheckCircle2 size={64} className="text-green-500" />
                    <div>
                      <h3 className="serif text-4xl italic text-editorial-text">Submission_Accepted</h3>
                      <p className="font-mono text-[9px] font-black uppercase tracking-[0.4em] text-editorial-text/30 mt-4 italic">GEN AI ARCHIVE VISUALIZATION READY</p>
                    </div>
                  </div>

                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="relative group aspect-video bg-editorial-text/5 border border-editorial-border overflow-hidden shadow-2xl"
                  >
                    {generatedImage ? (
                      <img 
                        src={generatedImage} 
                        alt="Event Visual" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="animate-spin text-editorial-accent" size={32} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-8">
                       <p className="font-mono text-[8px] text-white/60 tracking-widest uppercase italic">Conceptual_Visual_Output // Type: {formData.type}</p>
                    </div>
                  </motion.div>

                  <button
                    onClick={onClose}
                    className="font-mono text-editorial-accent text-[9px] font-black uppercase tracking-[0.4em] inline-block border border-editorial-accent pb-2 pt-3 px-12 hover:bg-editorial-accent hover:text-editorial-bg transition-all"
                  >
                    RETURN_TO_DASHBOARD
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
