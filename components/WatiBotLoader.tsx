"use client"

import React, { useState, useEffect } from "react"
import { createPortal } from "react-dom"

interface WatiBotLoaderProps {
  fullScreen?: boolean;
}

export default function WatiBotLoader({ fullScreen = false }: WatiBotLoaderProps = {}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const content = (
    <div className={
      fullScreen 
        ? "fixed inset-0 z-[99999] flex items-center justify-center bg-[#fafbfc] dark:bg-slate-950 transition-colors duration-500"
        : "w-full h-full min-h-screen flex items-center justify-center bg-transparent transition-colors duration-500"
    }>
 
      <div className="wati-loader-container relative w-72 h-72 flex items-center justify-center scale-95 md:scale-100">
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes sonar-wave {
            0% {
              transform: scale(0.6);
              opacity: 0.95;
              border-width: 5px;
            }
            35% {
              opacity: 0.75;
              border-width: 3px;
            }
            100% {
              transform: scale(2.55);
              opacity: 0;
              border-width: 0.8px;
            }
          }

          @keyframes rotating-aura {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }

          @keyframes center-pulse {
            0%, 100% {
              transform: scale(1);
              box-shadow: 
                0 0 20px color-mix(in srgb, var(--loader-primary) 35%, transparent), 
                0 0 45px color-mix(in srgb, var(--loader-primary) 15%, transparent),
                inset 0 1px 1px rgba(255, 255, 255, 0.2);
            }
            50% {
              transform: scale(1.03);
              box-shadow: 
                0 0 35px color-mix(in srgb, var(--loader-primary) 70%, transparent), 
                0 0 65px color-mix(in srgb, var(--loader-primary) 35%, transparent),
                inset 0 1px 2px rgba(255, 255, 255, 0.3);
            }
          }

          @keyframes ambient-glow {
            0%, 100% {
              opacity: 0.12;
              transform: scale(0.85);
            }
            50% {
              opacity: 0.28;
              transform: scale(1.1);
            }
          }

          .wati-loader-container {
            --loader-primary: var(--primary-color, #00c285);
            --loader-primary-dark: color-mix(in srgb, var(--loader-primary) 85%, black);
            --loader-primary-light: color-mix(in srgb, var(--loader-primary) 85%, white);
            --loader-badge-from: var(--loader-primary-dark);
            --loader-badge-to: var(--loader-primary-light);
            --loader-badge-inner: color-mix(in srgb, var(--loader-primary) 8%, black);
            
            --grid-1-opacity: 5%;
            --grid-2-opacity: 10%;
            --grid-3-opacity: 18%;
            --grid-4-opacity: 32%;
            --grid-5-opacity: 50%;
          }

          .dark .wati-loader-container,
          [class*="dark"] .wati-loader-container {
            --loader-badge-from: var(--loader-primary);
            --loader-badge-to: color-mix(in srgb, var(--loader-primary) 70%, white);
            --loader-badge-inner: color-mix(in srgb, var(--loader-primary) 4%, black);
            
            --grid-1-opacity: 10%;
            --grid-2-opacity: 15%;
            --grid-3-opacity: 24%;
            --grid-4-opacity: 38%;
            --grid-5-opacity: 60%;
          }

          .sonar-ripple {
            position: absolute;
            width: 78px;
            height: 78px;
            border-style: solid;
            border-color: color-mix(in srgb, var(--loader-primary) 85%, transparent);
            border-radius: 50%;
            background: radial-gradient(circle, color-mix(in srgb, var(--loader-primary) 5%, transparent) 0%, color-mix(in srgb, var(--loader-primary) 1%, transparent) 40%, transparent 80%);
            animation: sonar-wave 4s cubic-bezier(0.15, 0.85, 0.35, 1) infinite;
            pointer-events: none;
            box-shadow: 
              0 0 25px color-mix(in srgb, var(--loader-primary) 25%, transparent), 
              inset 0 0 12px color-mix(in srgb, var(--loader-primary) 10%, transparent);
            transform-origin: center;
          }
        ` }} />

        {/* 1. Volumetric Ambient Glow (Soft dynamic backdrop depth) */}
        <div 
          className="absolute w-40 h-40 rounded-full blur-[56px] pointer-events-none"
          style={{ 
            backgroundColor: 'var(--loader-primary)',
            animation: 'ambient-glow 7s ease-in-out infinite' 
          }}
        />

        {/* 2. Rotating Light Aura (Luxury conic light rays behind the logo badge) */}
        <div 
          className="absolute w-[94px] h-[94px] rounded-full opacity-45 blur-[3px] pointer-events-none z-0"
          style={{
            background: 'conic-gradient(from 0deg, transparent, color-mix(in srgb, var(--loader-primary) 65%, transparent), transparent 45%, color-mix(in srgb, var(--loader-primary) 65%, transparent), transparent 90%)',
            animation: 'rotating-aura 12s linear infinite'
          }}
        />

        {/* 3. Volumetric Glowing Radar Waves (Staggered continuous ripples) */}
        <div className="sonar-ripple" style={{ animationDelay: '0s' }} />
        <div className="sonar-ripple" style={{ animationDelay: '1.0s' }} />
        <div className="sonar-ripple" style={{ animationDelay: '2.0s' }} />
        <div className="sonar-ripple" style={{ animationDelay: '3.0s' }} />

        {/* 4. Sleek Concentric Guideline Grid (Adds structural precision) */}
        <div className="absolute w-[210px] h-[210px] rounded-full border-[1.2px]" style={{ borderColor: 'color-mix(in srgb, var(--loader-primary) var(--grid-1-opacity), transparent)' }} />
        <div className="absolute w-[176px] h-[176px] rounded-full border-[1.2px]" style={{ borderColor: 'color-mix(in srgb, var(--loader-primary) var(--grid-2-opacity), transparent)' }} />
        <div className="absolute w-[142px] h-[142px] rounded-full border-[1.5px]" style={{ borderColor: 'color-mix(in srgb, var(--loader-primary) var(--grid-3-opacity), transparent)' }} />
        <div className="absolute w-[114px] h-[114px] rounded-full border-[1.8px]" style={{ borderColor: 'color-mix(in srgb, var(--loader-primary) var(--grid-4-opacity), transparent)' }} />
        <div className="absolute w-[90px]  h-[90px]  rounded-full border-[2px]"   style={{ borderColor: 'color-mix(in srgb, var(--loader-primary) var(--grid-5-opacity), transparent)' }} />

        {/* 5. Central Interactive Badge */}
        {/* Glowing Dynamic active collar */}
        <div 
          className="relative w-[78px] h-[78px] rounded-full flex items-center justify-center z-10 select-none cursor-pointer border border-white/20 shadow-lg"
          style={{ 
            animation: 'center-pulse 3.5s ease-in-out infinite',
            background: 'linear-gradient(to top right, var(--loader-badge-from), var(--loader-badge-to))'
          }}
        >
          {/* Inner dark badge with reflective shadow */}
          <div 
            className="w-[58px] h-[58px] rounded-full flex items-center justify-center shadow-[inset_0_2px_5px_rgba(0,0,0,0.6)] overflow-hidden border border-black/10"
            style={{ backgroundColor: 'var(--loader-badge-inner)' }}
          >
            {/* WatiBot dynamic logo with custom shadow drop */}
            <img 
              src="/waitibot-loader.png" 
              alt="WatiBot" 
              className="w-[33px] h-[33px] object-contain select-none"
              style={{ filter: 'drop-shadow(0 2px 4px color-mix(in srgb, var(--loader-primary) 30%, transparent))' }}
            />
          </div>
        </div>

      </div>
    </div>
  )

  if (fullScreen && mounted) {
    return createPortal(content, document.body);
  }

  return content;
}
