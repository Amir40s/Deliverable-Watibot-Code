'use client';

// Client-side WebRTC Audio Call Widget

import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, X, FileText, Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePusher } from '@/components/providers/PusherProvider';
import { logCallActivity } from '@/app/actions/telephony';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface CallModalProps {
  organizationId?: string;
}

export function CallModal({ organizationId }: CallModalProps) {
  const [incomingCall, setIncomingCall] = useState<{
    callId: string;
    callerName: string;
    callerNumber: string;
    contactId?: string;
  } | null>(null);

  const [activeCall, setActiveCall] = useState<{
    callId: string;
    callerName: string;
    callerNumber: string;
    contactId?: string;
    direction: 'INBOUND' | 'OUTBOUND';
    startTime: number;
  } | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [notes, setNotes] = useState('');
  const [showNotesForm, setShowNotesForm] = useState(false);
  const [endedCallSummary, setEndedCallSummary] = useState<{
    contactId?: string;
    direction: 'INBOUND' | 'OUTBOUND';
    duration: number;
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringOscillatorRef = useRef<OscillatorNode | null>(null);

  // Play synthetic web audio ringtone when incoming call arrives
  const startRingtone = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      ringOscillatorRef.current = osc;
    } catch (e) {
      console.warn('AudioContext ringtone error:', e);
    }
  };

  const stopRingtone = () => {
    try {
      if (ringOscillatorRef.current) {
        ringOscillatorRef.current.stop();
        ringOscillatorRef.current.disconnect();
        ringOscillatorRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    } catch (e) {}
  };

  const { pusher } = usePusher();

  useEffect(() => {
    if (!organizationId || !pusher) return;

    const channel = pusher.subscribe(`org-${organizationId}`);

    const handleCall = (data: any) => {
      setIncomingCall({
        callId: data.callId || `call-${Date.now()}`,
        callerName: data.callerName || `+${data.callerNumber}`,
        callerNumber: data.callerNumber,
        contactId: data.contactId,
      });
      startRingtone();
    };

    channel.bind('incoming-call', handleCall);

    return () => {
      channel.unbind('incoming-call', handleCall);
      stopRingtone();
    };
  }, [organizationId, pusher]);

  // Active call timer ticker
  useEffect(() => {
    if (activeCall) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCall]);

  const handleAcceptCall = () => {
    stopRingtone();
    if (!incomingCall) return;

    setActiveCall({
      callId: incomingCall.callId,
      callerName: incomingCall.callerName,
      callerNumber: incomingCall.callerNumber,
      contactId: incomingCall.contactId,
      direction: 'INBOUND',
      startTime: Date.now(),
    });
    setCallDuration(0);
    setIncomingCall(null);
    toast.success(`Connected call with ${incomingCall.callerName}`);
  };

  const handleDeclineCall = async () => {
    stopRingtone();
    if (incomingCall && incomingCall.contactId) {
      await logCallActivity({
        contactId: incomingCall.contactId,
        direction: 'INBOUND',
        durationSeconds: 0,
        status: 'REJECTED',
      });
    }
    setIncomingCall(null);
    toast.info('Call declined');
  };

  const handleEndCall = async () => {
    if (!activeCall) return;

    const finalDuration = callDuration;
    const contactId = activeCall.contactId;
    const direction = activeCall.direction;

    setActiveCall(null);
    setCallDuration(0);

    if (contactId) {
      setEndedCallSummary({
        contactId,
        direction,
        duration: finalDuration,
      });
      setShowNotesForm(true);
    }

    toast.info(`Call ended. Duration: ${formatTime(finalDuration)}`);
  };

  const handleSaveCallNotes = async () => {
    if (!endedCallSummary || !endedCallSummary.contactId) {
      setShowNotesForm(false);
      return;
    }

    await logCallActivity({
      contactId: endedCallSummary.contactId,
      direction: endedCallSummary.direction,
      durationSeconds: endedCallSummary.duration,
      status: 'COMPLETED',
      notes: notes.trim() || undefined,
    });

    toast.success('Call notes saved to CRM chat history');
    setShowNotesForm(false);
    setNotes('');
    setEndedCallSummary(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!incomingCall && !activeCall && !showNotesForm) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full px-4 select-none">
      {/* 1. INCOMING CALL RINGING DIALOG */}
      {incomingCall && !activeCall && (
        <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-2xl border border-emerald-500/40 backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Phone className="w-6 h-6 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full animate-ping" />
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
                Incoming WhatsApp Call
              </span>
              <h4 className="font-bold text-sm text-white truncate">{incomingCall.callerName}</h4>
              <p className="text-xs text-slate-400 font-medium truncate">+{incomingCall.callerNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
            <Button
              onClick={handleDeclineCall}
              variant="outline"
              className="flex-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400 hover:text-red-300 font-bold text-xs gap-1.5 h-10"
            >
              <PhoneOff className="w-4 h-4" /> Decline
            </Button>
            <Button
              onClick={handleAcceptCall}
              className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-10 shadow-lg shadow-emerald-600/30"
            >
              <Phone className="w-4 h-4" /> Accept Call
            </Button>
          </div>
        </div>
      )}

      {/* 2. ACTIVE IN-BROWSER CALL BAR */}
      {activeCall && (
        <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-2xl border border-slate-800 backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                Live Call
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-full text-xs font-mono font-bold text-slate-200 border border-slate-700">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{formatTime(callDuration)}</span>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-base text-white truncate">{activeCall.callerName}</h4>
            <p className="text-xs text-slate-400 font-medium">+{activeCall.callerNumber}</p>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-slate-800/80">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                'rounded-xl border-slate-700 h-10 w-10 shrink-0',
                isMuted ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-slate-800 text-slate-300'
              )}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>

            <Button
              onClick={handleEndCall}
              className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-1.5 h-10 shadow-lg shadow-red-600/30"
            >
              <PhoneOff className="w-4 h-4" /> End Call
            </Button>
          </div>
        </div>
      )}

      {/* 3. POST-CALL NOTES FORM */}
      {showNotesForm && (
        <div className="bg-white dark:bg-[#0B132B] text-slate-900 dark:text-slate-100 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-5 duration-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              <h4 className="font-bold text-xs">Add Call Notes to CRM</h4>
            </div>
            <button
              onClick={() => setShowNotesForm(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Textarea
            placeholder="Type key call notes or follow-up actions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[80px] text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500"
          />

          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowNotesForm(false)}
              className="text-xs h-8 rounded-lg font-medium"
            >
              Skip
            </Button>
            <Button
              size="sm"
              onClick={handleSaveCallNotes}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 rounded-lg font-bold gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Save to Chat Thread
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
