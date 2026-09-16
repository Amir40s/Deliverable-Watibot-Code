import { useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, ChevronLeft, ChevronRight, CheckCheck, CheckCircle2, MessageSquare } from "lucide-react"

export type TemplateComponent = {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS" | "CAROUSEL";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO";
  text?: string;
  buttons?: Array<{
    type: "PHONE_NUMBER" | "URL" | "QUICK_REPLY" | "COPY_CODE";
    text: string;
    url?: string;
    phone_number?: string;
  }>;
  example?: {
    body_text?: string[][];
    header_text?: string[];
    header_handle?: string[];
  };
  cards?: Array<{
    components?: TemplateComponent[];
  }>;
}

export type MessageTemplate = {
  name: string;
  language: string;
  category?: string;
  status?: string;
  id?: string;
  components?: TemplateComponent[]
}

function parseFormattedWhatsAppLine(
  line: string,
  testValues?: Record<string, string>,
  keyPrefix: string = "wa"
): React.ReactNode[] {
  if (!line) return [];

  // Match:
  // 1. Triple-backtick code block: ```...```
  // 2. Single-backtick inline code: `...`
  // 3. Variable: {{digits}}, {{name}}, {{}}, {}}, {}
  // 4. Bold: *text* (no inner whitespace boundary)
  // 5. Italic: _text_
  // 6. Strikethrough: ~text~
  const tokenRegex = /(```[\s\S]*?```|`[^`]+?`|\{\{\s*[a-zA-Z0-9_]*\s*\}\}|\{\s*\}\}|\{\s*[a-zA-Z0-9_]+\s*\}|\*(?!\s)[^*]+?(?<!\s)\*|_(?!\s)[^_]+?(?<!\s)_|~(?!\s)[^~]+?(?<!\s)~)/g;

  const parts = line.split(tokenRegex);

  return parts.filter(part => part !== "").map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    // 1. Triple-backtick code block
    if (part.startsWith("```") && part.endsWith("```") && part.length >= 6) {
      const codeContent = part.slice(3, -3);
      return (
        <code key={key} className="font-mono text-[12px] bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded text-amber-800 dark:text-amber-300">
          {codeContent}
        </code>
      );
    }

    // 2. Single-backtick inline code
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const codeContent = part.slice(1, -1);
      return (
        <code key={key} className="font-mono text-[12px] bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded text-amber-800 dark:text-amber-300">
          {codeContent}
        </code>
      );
    }

    // 3. Variable: {{1}}, {{name}}, {{}}, {}}, {}
    const varMatch = part.match(/^(\{\{\s*([a-zA-Z0-9_]*)\s*\}\}|\{\s*\}\}|\{\s*([a-zA-Z0-9_]+)\s*\})$/);
    if (varMatch) {
      const varParam = (varMatch[2] ?? varMatch[3] ?? "").trim();
      let value: string | undefined = undefined;

      if (varParam && testValues?.[varParam]) {
        value = testValues[varParam];
      } else if (testValues) {
        if (varParam === "" || varParam.toLowerCase() === "name") {
          value = testValues["name"] || testValues["name_1"] || testValues["1"] || Object.values(testValues)[0];
        } else if (/^\d+$/.test(varParam)) {
          value = testValues[varParam];
        }
      }

      if (value !== undefined && value.trim() !== "") {
        return (
          <span
            key={key}
            className="font-medium text-[#00a884] bg-[#00a884]/10 shadow-[0_0_10px_rgba(0,168,132,0.1)] px-1.5 py-0.5 rounded-md transition-all inline-block"
          >
            {value}
          </span>
        );
      }

      return (
        <span
          key={key}
          className={cn(
            "font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border inline-block transition-all",
            varParam
              ? "text-[#00a884] bg-[#00a884]/10 border-[#00a884]/30"
              : "text-[#00a884] bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30"
          )}
        >
          {part === "{{}}" || part === "{}}" || part === "{}" ? "{{Name}}" : part}
        </span>
      );
    }

    // 4. Bold: *...*
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <strong key={key} className="font-bold text-slate-900 dark:text-white">
          {parseFormattedWhatsAppLine(inner, testValues, `${key}-b`)}
        </strong>
      );
    }

    // 5. Italic: _..._
    if (part.startsWith("_") && part.endsWith("_") && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <em key={key} className="italic">
          {parseFormattedWhatsAppLine(inner, testValues, `${key}-i`)}
        </em>
      );
    }

    // 6. Strikethrough: ~...~
    if (part.startsWith("~") && part.endsWith("~") && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <del key={key} className="line-through opacity-75">
          {parseFormattedWhatsAppLine(inner, testValues, `${key}-s`)}
        </del>
      );
    }

    // Plain text
    return <span key={key}>{part}</span>;
  });
}

export function renderWhatsAppFormattedText(
  text: string | undefined,
  testValues?: Record<string, string>
): React.ReactNode {
  if (!text) return null;

  const lines = text.split("\n");

  return (
    <>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className="block min-h-[1.25em]">
          {line === "" ? "\u00A0" : parseFormattedWhatsAppLine(line, testValues, `l-${lineIndex}`)}
        </span>
      ))}
    </>
  );
}

export const WhatsAppTemplatePreview = ({
  template,
  getStatusColor,
  testValues,
  mediaUrl
}: {
  template: MessageTemplate;
  getStatusColor: (s: string) => string;
  testValues?: Record<string, string>;
  mediaUrl?: string | null;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioTime, setAudioTime] = useState("0:00");
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 288;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#efeae2] dark:bg-[#0b141a] rounded-[24px] border border-gray-200 dark:border-slate-800 border-dashed opacity-60">
        <div className="text-sm font-medium text-slate-400">Select a template to preview</div>
      </div>
    );
  }

  const header = template.components?.find(c => c.type === "HEADER");
  const body = template.components?.find(c => c.type === "BODY");
  const footer = template.components?.find(c => c.type === "FOOTER");
  const carousel = template.components?.find(c => c.type === "CAROUSEL");
  const buttons = template.components?.find(c => c.type === "BUTTONS")?.buttons;

  return (
    <div className="flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a] rounded-[24px] overflow-hidden border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 ">
       <div className="relative p-6 pt-8 pb-10 flex-1 flex flex-col items-center justify-center min-h-[220px]">
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none grayscale"
          style={{
            backgroundImage: 'url("https://w0.peakpx.com/wallpaper/580/638/wallpaper-whatsapp-background.jpg")',
            backgroundSize: '240px',
            backgroundRepeat: 'repeat'
          }}
        ></div>

         <div className="relative z-10 w-full max-w-[280px]">
          {/* WhatsApp Header Mockup */}
          <div className="bg-[#008069] dark:bg-[#1f2c33] text-white px-3 py-2 rounded-t-xl flex items-center justify-between shadow-sm mb-1.5 ring-1 ring-black/5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                <MessageSquare className="w-3 h-3 text-white" />
              </div>
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-[11px] font-semibold flex items-center gap-1 truncate text-white">
                  WhatsApp Business
                  <CheckCircle2 className="w-2.5 h-2.5 text-[#25D366] fill-[#25D366] stroke-white shrink-0" />
                </span>
                <span className="text-[8.5px] text-white/80">Official Business Account</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1f2c33] rounded-2xl rounded-tl-none shadow-sm shadow-black/5 overflow-hidden ring-1 ring-black/5">
             {header && header.format === "IMAGE" && (
              <div className="p-1 pb-0 w-full">
                <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800 rounded-[10px]">
                  {mediaUrl ? (
                    <img
                      src={mediaUrl}
                      alt="Selected Media"
                      className="object-cover w-full h-full"
                    />
                  ) : mediaUrl === undefined && header.example?.header_handle?.[0] ? (
                    <img
                      src={header.example.header_handle[0]}
                      alt="Template Header"
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-slate-400 text-xs bg-slate-200 dark:bg-slate-700/50">
                      <div className="flex flex-col items-center gap-1.5 opacity-60">

                        <span className="font-medium tracking-wide">Image Header</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {header && header.format === "VIDEO" && (
              <div className="p-1 pb-0 w-full">
                <div
                  className="relative aspect-video w-full overflow-hidden bg-black flex items-center justify-center text-slate-400 text-xs rounded-[10px] group cursor-pointer"
                  onClick={() => {
                    if (videoRef.current) {
                      if (videoRef.current.paused) {
                        videoRef.current.play();
                        setIsVideoPlaying(true);
                      } else {
                        videoRef.current.pause();
                        setIsVideoPlaying(false);
                      }
                    }
                  }}
                >
                  {mediaUrl || header.example?.header_handle?.[0] ? (
                    <>
                      <video
                        ref={videoRef}
                        src={mediaUrl || header.example?.header_handle?.[0]}
                        controls={false}
                        onPlay={() => setIsVideoPlaying(true)}
                        onPause={() => setIsVideoPlaying(false)}
                        onEnded={() => setIsVideoPlaying(false)}
                        className={cn("w-full h-full object-cover", !isVideoPlaying && "opacity-90")}
                      />

                      <div className={cn("absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300", isVideoPlaying ? "opacity-0 group-hover:opacity-100" : "bg-black/10 opacity-100")}>
                        <div className="w-[52px] h-[52px] bg-black/40 rounded-full flex items-center justify-center backdrop-blur-sm shadow-sm transition-colors">
                          {!isVideoPlaying ? (
                            <div className="w-0 h-0 border-t-[10px] border-b-[10px] border-l-[16px] border-t-transparent border-b-transparent border-l-white ml-1.5 opacity-90"></div>
                          ) : (
                            <div className="flex gap-1.5 opacity-90">
                              <div className="w-[5px] h-[18px] bg-white rounded-[1px]"></div>
                              <div className="w-[5px] h-[18px] bg-white rounded-[1px]"></div>
                            </div>
                          )}
                        </div>
                      </div>
                      {!isVideoPlaying && (
                        <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm rounded-[4px] px-1.5 py-[2px] pointer-events-none">
                          <span className="text-white text-[10px] font-medium tracking-wide">0:15</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 opacity-60 pointer-events-none">
                      <div className="w-[52px] h-[52px] bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <div className="w-0 h-0 border-t-[10px] border-b-[10px] border-l-[16px] border-t-transparent border-b-transparent border-l-white ml-1.5 opacity-90"></div>
                      </div>
                      <span className="font-medium text-white">Video Header</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {header && header.format === "AUDIO" && (
              <div className="p-1 pb-0 w-full">
                <div className="relative w-full overflow-hidden bg-black/5 dark:bg-black/20 rounded-xl flex items-center p-3 gap-3">
                  <div
                    className="w-[42px] h-[42px] bg-[#00a884] rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer shadow-sm hover:bg-[#008f6f] transition-colors"
                    onClick={() => {
                      if (audioRef.current) {
                        if (audioRef.current.paused) {
                          audioRef.current.play();
                          setIsAudioPlaying(true);
                        } else {
                          audioRef.current.pause();
                          setIsAudioPlaying(false);
                        }
                      }
                    }}
                  >
                    {!isAudioPlaying ? (
                      <div className="w-0 h-0 border-t-[7px] border-b-[7px] border-l-[11px] border-t-transparent border-b-transparent border-l-white ml-1"></div>
                    ) : (
                      <div className="flex gap-1">
                        <div className="w-[3px] h-[14px] bg-white rounded-[1px]"></div>
                        <div className="w-[3px] h-[14px] bg-white rounded-[1px]"></div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 justify-center">
                    {/* Audio progress bar */}
                    <div
                      className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden cursor-pointer relative"
                      onClick={(e) => {
                        if (audioRef.current && audioRef.current.duration) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickX = e.clientX - rect.left;
                          const newTime = (clickX / rect.width) * audioRef.current.duration;
                          audioRef.current.currentTime = newTime;
                        }
                      }}
                    >
                      <div className="h-full bg-[#00a884] transition-all duration-100" style={{ width: `${audioProgress}%` }}></div>
                    </div>
                    <div className="flex justify-between items-center w-full">
                      <span className="text-[11px] text-[#667781] dark:text-[#8696a0] font-medium">{audioTime}</span>
                      {(mediaUrl || header.example?.header_handle?.[0]) && (
                        <audio
                          ref={audioRef}
                          src={mediaUrl || header.example?.header_handle?.[0]}
                          className="hidden"
                          onEnded={() => {
                            setIsAudioPlaying(false);
                            setAudioProgress(0);
                            if (audioRef.current) setAudioTime(formatTime(audioRef.current.duration));
                          }}
                          onPause={() => setIsAudioPlaying(false)}
                          onPlay={() => setIsAudioPlaying(true)}
                          onLoadedMetadata={() => {
                            if (audioRef.current) {
                              setAudioTime(formatTime(audioRef.current.duration));
                            }
                          }}
                          onTimeUpdate={() => {
                            if (audioRef.current) {
                              const current = audioRef.current.currentTime;
                              const duration = audioRef.current.duration;
                              if (duration) {
                                setAudioProgress((current / duration) * 100);
                              }
                              if (current > 0 && !audioRef.current.paused) {
                                setAudioTime(formatTime(current));
                              }
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {header && header.format === "DOCUMENT" && (
              <div className="flex flex-col w-full">
                <div className="w-full h-[140px] bg-white relative overflow-hidden border-b border-gray-100 dark:border-white/5 rounded-t-xl bg-[#525659]">
                  {(mediaUrl || header.example?.header_handle?.[0]) ? (
                    (() => {
                      const url = mediaUrl || header.example?.header_handle?.[0] || "";
                      const isPdf = url.toLowerCase().split('?')[0].endsWith('.pdf');
                      const isCloudinary = url.includes('cloudinary.com');

                      if (isPdf && isCloudinary) {
                        const thumbnailUrl = url.replace(/\.pdf(\?.*)?$/i, '.jpg$1');
                        return (
                          <img
                            src={thumbnailUrl}
                            alt="Document Preview"
                            className="w-full h-[140px] object-cover object-top pointer-events-none bg-white"
                          />
                        );
                      }

                      return (
                        <embed
                          src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                          type={isPdf ? "application/pdf" : undefined}
                          className="w-[102%] h-[600px] border-none absolute top-[-56px] left-[-1%] pointer-events-none bg-white"
                        />
                      );
                    })()
                  ) : (
                    <div className="w-full h-full flex flex-col pt-5 px-6 relative bg-white">
                      <div className="font-bold text-black text-[15px] mb-3 font-serif tracking-tight">Document Preview</div>
                      <div className="text-black text-[9px] font-bold mb-0.5">Dear User,</div>
                      <div className="text-black text-[9px] font-bold mb-3">Date: {new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}</div>
                      <div className="text-black text-[9px] leading-relaxed">
                        Upload a document to see its live preview here. The first page will be displayed as a thumbnail.
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-transparent pointer-events-auto z-10"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none z-20"></div>
                </div>
                <div className="p-1.5 pt-1.5">
                  <div className="relative w-full overflow-hidden bg-black/5 dark:bg-black/20 rounded-xl flex items-center p-3">
                    {mediaUrl || header.example?.header_handle?.[0] ? (
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-shrink-0 w-[42px] h-[42px] bg-[#F40F02] rounded-md flex items-center justify-center text-white font-bold text-[12px] shadow-sm">
                          PDF
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 justify-center gap-0.5">
                          <span className="truncate text-[#111b21] dark:text-[#e9edef] text-[15px] leading-tight font-medium">
                            {(mediaUrl || header.example?.header_handle?.[0] || "").split('/').pop()}
                          </span>
                          <span className="text-[#667781] dark:text-[#8696a0] text-[13px] truncate flex items-center gap-1.5 font-normal">
                            2 pages <span className="text-[8px] opacity-70">•</span> PDF <span className="text-[8px] opacity-70">•</span> 261 kB
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 w-full opacity-90">
                        <div className="flex-shrink-0 w-[42px] h-[42px] bg-[#F40F02] rounded-md flex items-center justify-center text-white font-bold text-[12px] shadow-sm">
                          PDF
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 justify-center gap-0.5">
                          <span className="truncate text-[#111b21] dark:text-[#e9edef] text-[15px] leading-tight font-medium">
                            Employment Contract John.pdf
                          </span>
                          <span className="text-[#667781] dark:text-[#8696a0] text-[13px] truncate flex items-center gap-1.5 font-normal">
                            2 pages <span className="text-[8px] opacity-70">•</span> PDF <span className="text-[8px] opacity-70">•</span> 261 kB
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 pb-2 space-y-1">
              {/* Header Text */}
              {header && header.format !== "IMAGE" && header.format !== "VIDEO" && header.format !== "DOCUMENT" && header.format !== "AUDIO" && (
                <div className="font-bold text-[13.5px] text-[#111b21] dark:text-gray-100 mb-1">
                  {renderWhatsAppFormattedText(header.text, testValues)}
                </div>
              )}

              {/* Body */}
              <div className="text-[14px] text-[#111b21] dark:text-gray-200 leading-[1.4] whitespace-pre-wrap break-words">
                {renderWhatsAppFormattedText(body?.text, testValues)}
              </div>

              {/* Footer */}
              {footer && (
                <div className="text-[12px] text-[#667781] dark:text-gray-400 mt-1">
                  {footer.text}
                </div>
              )}

              {/* Timestamp and Read Status */}
              <div className="flex items-center justify-end gap-1 pt-0.5">
                <span className="text-[10px] text-[#667781] dark:text-gray-400 font-medium">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
              </div>
            </div>

            {/* Buttons Section */}
            {buttons && buttons.length > 0 && (
              <div className="border-t border-[#e9edef] dark:border-white/5 flex flex-col divide-y divide-[#e9edef] dark:divide-white/5">
                {buttons.map((btn, idx) => (
                  <button
                    key={idx}
                    className="py-2.5 px-3 flex items-center justify-center gap-2 text-[#00a884] dark:text-[#53bdeb] text-[13.5px] font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {(btn.type === 'URL' || btn.type === 'PHONE_NUMBER') && <ExternalLink className="w-3.5 h-3.5" />}
                    {btn.text}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Triangle Tail */}
          <div className="absolute top-10 -left-2 w-3 h-4 bg-white dark:bg-[#1f2c33]" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}></div>

          {/* Carousel Cards Container */}
          {carousel && carousel.cards && carousel.cards.length > 0 && (
            <div className="relative mt-2 -mx-6 px-6 group">
              <div 
                ref={carouselRef}
                className="flex gap-2 overflow-x-auto pb-4 snap-x" 
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {carousel.cards.map((card, idx) => {
                  const cardHeader = card.components?.find(c => c.type === "HEADER");
                  const cardBody = card.components?.find(c => c.type === "BODY");
                  const cardButtons = card.components?.find(c => c.type === "BUTTONS")?.buttons;

                  return (
                    <div key={idx} className="bg-white dark:bg-[#1f2c33] rounded-2xl shadow-sm shadow-black/5 overflow-hidden ring-1 ring-black/5 min-w-[280px] max-w-[280px] shrink-0 snap-center flex flex-col">
                      {/* Card Header Media */}
                      {cardHeader && cardHeader.format === "IMAGE" && (
                        <div className="w-full aspect-video bg-slate-100 dark:bg-slate-800">
                          {cardHeader.example?.header_handle?.[0] ? (
                            <img src={cardHeader.example.header_handle[0]} alt="Card Image" className="object-cover w-full h-full" />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full text-slate-400 text-xs bg-slate-200 dark:bg-slate-700/50 opacity-60">Image</div>
                          )}
                        </div>
                      )}
                      {cardHeader && cardHeader.format === "VIDEO" && (
                        <div className="w-full aspect-video bg-slate-100 dark:bg-slate-800 relative">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                              <div className="w-0 h-0 border-t-[6px] border-b-[6px] border-l-[10px] border-transparent border-l-white ml-1"></div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Card Body */}
                      <div className="p-3 pb-2 text-[13px] text-[#111b21] dark:text-gray-200 leading-[1.4] whitespace-pre-wrap flex-1 break-words">
                        {renderWhatsAppFormattedText(cardBody?.text, testValues)}
                      </div>

                      {/* Card Buttons */}
                      {cardButtons && cardButtons.length > 0 && (
                        <div className="border-t border-[#e9edef] dark:border-white/5 flex flex-col divide-y divide-[#e9edef] dark:divide-white/5 mt-auto">
                          {cardButtons.map((btn, btnIdx) => (
                            <button
                              key={btnIdx}
                              className="py-2.5 px-3 flex items-center justify-center gap-2 text-[#00a884] dark:text-[#53bdeb] text-[13px] font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                            >
                              {(btn.type === 'URL' || btn.type === 'PHONE_NUMBER') && <ExternalLink className="w-3.5 h-3.5" />}
                              <span className="truncate">{btn.text || "Button"}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Scroll Controls */}
              {carousel.cards.length > 1 && (
                <>
                  <button 
                    onClick={() => scrollCarousel('left')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 z-10 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => scrollCarousel('right')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 z-10 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Template Info Footer */}
      <div className="px-6 py-4 bg-white dark:bg-[#111b21] border-t border-gray-100 dark:border-slate-800 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold text-gray-400 truncate max-w-[180px]">
            {template.name}
          </span>
          <Badge variant="outline" className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border shadow-none", getStatusColor(template.status ?? "PENDING"))}>
            {template.status ?? "PENDING"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-none px-2 py-0.5">
            {template.language}
          </Badge>
          <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-none px-2 py-0.5">
            {template.category}
          </Badge>
        </div>
      </div>
    </div>
  );
};
