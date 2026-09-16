"use client";

import React, { useState, useRef } from "react";
import { Mic, Upload, Play, Square, Loader2, MessageSquare, Volume2 } from "lucide-react";
import { testVoiceTranscription } from "@/app/actions/voice-test";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function VoiceTestPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ duration: string; cost: string } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const targetSampleRate = 16000;

      const leftChannel: Float32Array[] = [];

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        leftChannel.push(new Float32Array(input));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      const stop = () => {
        processor.disconnect();
        source.disconnect();
        stream.getTracks().forEach(track => track.stop());
        
        // Merge chunks
        const flatChannel = flattenArray(leftChannel);
        // Downsample
        const downsampled = downsample(flatChannel, audioContext.sampleRate, targetSampleRate);
        // Create WAV
        const wavBuffer = encodeWAV(downsampled, targetSampleRate);
        const audioBlob = new Blob([wavBuffer], { type: "audio/wav" });
        
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        handleUpload(audioBlob);
        setIsRecording(false);
      };

      (window as any).stopRecordingFunc = stop;
      setIsRecording(true);
      setTranscript(null);
    } catch (err) {
      toast.error("Microphone access denied or not available");
    }
  };

  const stopRecording = () => {
    if ((window as any).stopRecordingFunc) {
      (window as any).stopRecordingFunc();
    }
  };

  // Helper functions for WAV encoding and downsampling
  function downsample(buffer: Float32Array, fromRate: number, toRate: number) {
    if (toRate === fromRate) return buffer;
    const ratio = fromRate / toRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0, count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  function flattenArray(channelBuffer: Float32Array[]) {
    const result = new Float32Array(channelBuffer.reduce((acc, b) => acc + b.length, 0));
    let offset = 0;
    for (const buffer of channelBuffer) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    return result;
  }

  function encodeWAV(samples: Float32Array, sampleRate: number) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioUrl(URL.createObjectURL(file));
      handleUpload(file);
    }
  };

  const handleUpload = async (blob: Blob | File) => {
    setIsTranscribing(true);
    setTranscript(null);

    const formData = new FormData();
    formData.append("file", blob, blob instanceof File ? blob.name : "recording.ogg");

    try {
      const result = await testVoiceTranscription(formData);
      if (result.success) {
        setTranscript(result.text || "No text detected.");
        setUsage(result.usage || null);
        toast.success("Transcription complete!");
      } else {
        toast.error(result.error || "Failed to transcribe");
      }
    } catch (err) {
      toast.error("An error occurred during transcription");
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      <div className="flex flex-col items-center mb-12 text-center">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-4">
          <Volume2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">AI Voice Accuracy Test</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-xl text-lg">
          Test our high-accuracy AI transcription system. Record your voice or upload an audio file to see how it converts speech to text in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-8 border-none shadow-2xl bg-white dark:bg-slate-900/50 backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Mic className="w-24 h-24" />
          </div>
          
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Input Source
          </h2>

          <div className="flex flex-col gap-4">
            <Button
              size="lg"
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "destructive" : "default"}
              className="h-20 text-lg rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isRecording ? (
                <>
                  <Square className="w-6 h-6 mr-3 animate-pulse" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="w-6 h-6 mr-3" />
                  Start Voice Recording
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-900 px-2 text-slate-500">Or Upload File</span>
              </div>
            </div>

            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group/upload">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-slate-400 group-hover/upload:text-emerald-500 transition-colors" />
                <p className="text-sm text-slate-500 dark:text-slate-400">MP3, WAV, OGG (Max 10MB)</p>
              </div>
              <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} />
            </label>
          </div>

          {audioUrl && (
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Audio Preview</p>
              <audio src={audioUrl} controls className="w-full h-10 rounded-lg" />
            </div>
          )}
        </Card>

        <Card className="p-8 border-none shadow-2xl bg-slate-50 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-500" />
            AI Output
          </h2>

          <div className="flex-grow flex flex-col">
            {isTranscribing ? (
              <div className="flex-grow flex flex-col items-center justify-center py-12 text-slate-500">
                <Loader2 className="w-12 h-12 mb-4 animate-spin text-emerald-500" />
                <p className="animate-pulse">Analyzing your voice...</p>
                <p className="text-xs mt-2">Converting audio to text using OpenAI Whisper</p>
              </div>
            ) : transcript ? (
              <div className="flex-grow">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-700 min-h-[150px]">
                  <p className="text-lg leading-relaxed text-slate-800 dark:text-slate-200 italic font-medium">
                    "{transcript}"
                  </p>
                </div>
                
                {usage && (
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30">
                      <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 uppercase font-bold tracking-wider mb-1">Duration</p>
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{usage.duration}s</p>
                    </div>
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30">
                      <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 uppercase font-bold tracking-wider mb-1">Est. Cost</p>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-400">${usage.cost}</p>
                    </div>
                  </div>
                )}

                <div className="mt-6 p-4 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Accuracy: High (98%+)
                  </p>
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">
                    Language detected automatically. Supports Urdu, English, and Roman script.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dotted border-slate-200 dark:border-slate-800 rounded-2xl">
                <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                <p>Transcript will appear here...</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-12 text-center text-slate-500 text-sm">
        <p>This test uses the same engine that powers your automated WhatsApp replies.</p>
      </div>
    </div>
  );
}
