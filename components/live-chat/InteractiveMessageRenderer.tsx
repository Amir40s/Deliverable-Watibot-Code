import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import { ListFilter, ExternalLink, Package, ShoppingBag, FileText, MousePointer2, ChevronDown, ChevronUp, Ban, ZoomIn, Info, Play, Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MediaLightboxModal, MediaLightboxData } from "./MediaLightboxModal";

interface InteractiveMessageRendererProps {
    msg: any;
    isOutbound: boolean;
    templates?: any[];
    onOpenMedia?: (data: MediaLightboxData) => void;
}

function parseRawBody(rawBody: any) {
    if (typeof rawBody !== 'string') return rawBody;
    try {
        return JSON.parse(rawBody);
    } catch {
        return null;
    }
}

function getMetaTemplatePayload(rawBody: any) {
    return rawBody?.sentPayload?.message?.attachment?.payload
        || rawBody?.message?.attachment?.payload
        || rawBody?.attachment?.payload
        || null;
}

function getMediaKind(mediaUrl?: string | null) {
    const lowercaseUrl = (mediaUrl || '').toLowerCase();
    if (lowercaseUrl.match(/\.(mp4|mov|avi|webm)(\?|#|$)/)) return 'video';
    if (lowercaseUrl.match(/\.(mp3|ogg|wav|m4a)(\?|#|$)/)) return 'audio';
    return 'image';
}

function cleanTemplateFallback(content?: string | null) {
    if (!content || /^template:\s*undefined$/i.test(content.trim())) {
        return 'Template message';
    }
    return content;
}

export function FormattedMessageText({ text, className }: { text?: string | null; className?: string }) {
    if (!text) return null;

    const tokenRegex = /(\[[^\]]+\]\((https?:\/\/[^\s\)]+)\))|(https?:\/\/[^\s]+)/g;

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            elements.push(text.substring(lastIndex, match.index));
        }

        if (match[1]) {
            const mdMatch = /^\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)$/.exec(match[1]);
            if (mdMatch) {
                const label = mdMatch[1];
                const url = mdMatch[2];
                elements.push(
                    <a
                        key={match.index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 break-all [overflow-wrap:anywhere]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {label}
                    </a>
                );
            } else {
                elements.push(match[1]);
            }
        } else if (match[3]) {
            const rawUrl = match[3];
            elements.push(
                <a
                    key={match.index}
                    href={rawUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 break-all [overflow-wrap:anywhere]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {rawUrl}
                </a>
            );
        }

        lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        elements.push(text.substring(lastIndex));
    }

    return (
        <span className={cn("whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] max-w-full min-w-0 inline-block", className)}>
            {elements}
        </span>
    );
}

export function InteractiveMessageRenderer({ msg, isOutbound, templates, onOpenMedia }: InteractiveMessageRendererProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [localLightbox, setLocalLightbox] = useState<MediaLightboxData | null>(null);
    const rawBody = parseRawBody(msg.rawBody);

    const handleMediaClick = (mediaData: MediaLightboxData) => {
        if (!mediaData.url) return;
        if (onOpenMedia) {
            onOpenMedia(mediaData);
        } else {
            setLocalLightbox(mediaData);
        }
    };

    const isRevoked = msg?.status === 'revoked' ||
                      rawBody?.isRevoked === true ||
                      (msg?.content || '').trim().toLowerCase() === '[revoke]' || 
                      (msg?.content || '').trim().toLowerCase() === '[protocol]' || 
                      msg?.type === 'revoke' || 
                      msg?.type === 'protocol' ||
                      rawBody?.protocol?.type === 'revoke';

    const hasRealContent = msg?.content && 
                           msg.content.trim().toLowerCase() !== '[revoke]' && 
                           msg.content.trim().toLowerCase() !== '[protocol]';

    if (isRevoked) {
        return (
            <div className="flex flex-col gap-1 py-1 px-1.5">
                <div className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400 font-bold italic text-[11px] select-none border-b border-rose-200/40 dark:border-rose-900/40 pb-1">
                    <Ban className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>This message was deleted by sender</span>
                </div>
                {hasRealContent ? (
                    <p className="text-[14.2px] leading-snug whitespace-pre-wrap break-words pt-0.5">{msg.content}</p>
                ) : (
                    <span className="text-[12px] italic text-slate-400">Original content unavailable</span>
                )}
            </div>
        );
    }

    const isSystemMsg = msg?.type === 'system' ||
                        (msg?.content || '').trim().toLowerCase() === '[system]' ||
                        rawBody?.system != null;

    if (isSystemMsg) {
        const sys = rawBody?.system;
        const sysText = sys?.body || sys?.text || (sys?.type ? `WhatsApp Notification: ${sys.type.replace(/_/g, ' ')}` : null);
        const displayContent = sysText || (hasRealContent && msg.content !== '[system]' ? msg.content : 'WhatsApp System Event / Security Notification');

        return (
            <div className="flex flex-col gap-1 py-1 px-1.5 min-w-[180px]">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[11px] select-none border-b border-amber-200/40 dark:border-amber-900/40 pb-1">
                    <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>System Notification</span>
                </div>
                <p className="text-[13px] leading-snug font-medium pt-0.5 text-slate-700 dark:text-slate-200">
                    {displayContent}
                </p>
            </div>
        );
    }

    // Meta / Facebook Security OTP Message Handling
    const contentStr = String(msg?.content || '');
    const META_SECURITY_NUMBERS = [
        '447974904959',
        '12485302708',
        '447710173736',
        '16505434800',
        '447441923485',
        '447441923486',
        '16508531300',
        '16503087300',
        '16503087320',
        '18332639993',
        '18339582008'
    ];
    const senderFrom = String(rawBody?.from || '').replace(/\D/g, '');
    const isMetaNumber = META_SECURITY_NUMBERS.includes(senderFrom);

    const isMetaSecurity = isMetaNumber ||
                           contentStr.includes('Facebook Confirmation Code') ||
                           contentStr.includes('Facebook confirmation code') ||
                           contentStr.includes('Instagram code') ||
                           (contentStr.includes('Meta / Facebook Login Verification') && isMetaNumber) ||
                           (contentStr.includes('Meta / Facebook Security') && isMetaNumber);

    const otpCodeMatch = contentStr.match(/\b(\d{4,8})\b/);
    const otpCode = otpCodeMatch ? otpCodeMatch[1] : null;

    if (isMetaSecurity) {
        return (
            <div className="flex flex-col gap-2 p-3 min-w-[260px] max-w-[340px] rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border-2 border-blue-200 dark:border-blue-900/60 shadow-sm text-start">
                <div className="flex items-center justify-between border-b border-blue-200/60 dark:border-blue-900/60 pb-2">
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-[#1877F2] text-white flex items-center justify-center text-[10px] font-black shadow-sm">
                            f
                        </div>
                        <span className="text-xs font-bold text-[#1877F2] dark:text-blue-400">
                            Meta Security Verification
                        </span>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1877F2]/10 text-[#1877F2] dark:text-blue-300 border border-[#1877F2]/20">
                        Official 2FA
                    </span>
                </div>

                {otpCode ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            Your confirmation code:
                        </span>
                        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border-2 border-[#1877F2]/40 shadow-sm">
                            <span className="text-2xl font-black tracking-widest text-[#1877F2] dark:text-blue-400 font-mono">
                                {otpCode}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(otpCode);
                                    toast.success('Confirmation code copied: ' + otpCode);
                                }}
                                className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 text-[#1877F2] dark:text-blue-400 transition active:scale-95 cursor-pointer"
                                title="Copy confirmation code"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="py-1 space-y-1">
                        <div className="flex items-start gap-1.5 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                            <ShieldCheck className="w-4 h-4 shrink-0 text-[#1877F2] mt-0.5" />
                            <p className="leading-relaxed">
                                {contentStr.replace(/\[Unsupported:.*?by Meta\]/gi, 'Meta Authentication Template delivered.')}
                            </p>
                        </div>
                    </div>
                )}

                <p className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center pt-1 border-t border-blue-100 dark:border-blue-900/30">
                    Do not share this code with anyone. Meta will never ask for it.
                </p>
            </div>
        );
    }

    const metaTemplatePayload = getMetaTemplatePayload(rawBody);
    const metaElements = Array.isArray(metaTemplatePayload?.elements) ? metaTemplatePayload.elements : [];
    const metaChannel = msg.platform === 'FACEBOOK' ? 'Facebook' : msg.platform === 'INSTAGRAM' ? 'Instagram' : 'Meta';

    if (metaTemplatePayload?.template_type === 'generic' && metaElements.length > 0) {
        const label = metaElements.length > 1 ? `${metaChannel} Carousel` : `${metaChannel} Card`;

        return (
            <div className={cn(
                "flex flex-col min-w-[240px] max-w-[380px] rounded-lg overflow-hidden shadow-sm",
                isOutbound
                    ? "bg-[#d9fdd3] dark:bg-[#005c4b] border border-black/5 dark:border-white/5 text-gray-900 dark:text-gray-100"
                    : "bg-white dark:bg-[#202c33] border border-black/5 dark:border-white/5 text-gray-900 dark:text-gray-100"
            )}>
                <div className="bg-black/5 dark:bg-white/5 px-3 py-1 flex items-center justify-between border-b border-black/5">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                        {label}
                    </span>
                    <Package className="w-3 h-3 opacity-30" />
                </div>
                <div className={cn(
                    "p-2 gap-2",
                    metaElements.length > 1 ? "flex overflow-x-auto max-w-[380px]" : "flex flex-col"
                )}>
                    {metaElements.map((element: any, index: number) => (
                        <div
                            key={`${element.title || 'card'}-${index}`}
                            className={cn(
                                "bg-white/70 dark:bg-black/10 border border-black/5 dark:border-white/10 rounded-lg overflow-hidden shrink-0",
                                metaElements.length > 1 ? "w-[220px]" : "w-full"
                            )}
                        >
                            {element.image_url && (
                                <div 
                                    className="relative cursor-pointer group"
                                    onClick={() => handleMediaClick({ url: element.image_url, type: 'image', caption: element.title })}
                                >
                                    <img
                                        src={element.image_url}
                                        alt={element.title || 'Instagram card'}
                                        className="w-full h-32 object-cover bg-black/5 group-hover:opacity-90 transition-opacity"
                                    />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIn className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            )}
                            <div className="px-3 py-2">
                                {element.title && (
                                    <p className="text-[14px] font-bold leading-snug whitespace-pre-wrap">
                                        {element.title}
                                    </p>
                                )}
                                {element.subtitle && (
                                    <p className="text-[12px] opacity-70 leading-snug whitespace-pre-wrap mt-1">
                                        {element.subtitle}
                                    </p>
                                )}
                            </div>
                            {Array.isArray(element.buttons) && element.buttons.length > 0 && (
                                <div className="border-t border-black/5 dark:border-white/10 divide-y divide-black/5 dark:divide-white/10">
                                    {element.buttons.map((button: any, buttonIndex: number) => (
                                        <div
                                            key={`${button.title || button.text || 'button'}-${buttonIndex}`}
                                            className="py-2 px-3 text-center font-bold text-xs text-[#00a884] flex items-center justify-center gap-1.5"
                                        >
                                            {button.type === 'web_url' && <ExternalLink className="w-3 h-3" />}
                                            {button.title || button.text || 'Button'}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {localLightbox && (
                    <MediaLightboxModal 
                        isOpen={!!localLightbox} 
                        onClose={() => setLocalLightbox(null)} 
                        data={localLightbox} 
                    />
                )}
            </div>
        );
    }

    if (msg.type === 'template' && msg.mediaUrl && !rawBody?.template) {
        const mediaKind = getMediaKind(msg.mediaUrl);
        const caption = cleanTemplateFallback(msg.content);

        return (
            <div className={cn(
                "flex flex-col min-w-[240px] max-w-[320px] rounded-lg overflow-hidden shadow-sm",
                isOutbound
                    ? "bg-[#d9fdd3] dark:bg-[#005c4b] border border-black/5 dark:border-white/5 text-gray-900 dark:text-gray-100"
                    : "bg-white dark:bg-[#202c33] border border-black/5 dark:border-white/5 text-gray-900 dark:text-gray-100"
            )}>
                <div className="bg-black/5 dark:bg-white/5 px-3 py-1 flex items-center justify-between border-b border-black/5">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                        {metaChannel} Media
                    </span>
                    <Package className="w-3 h-3 opacity-30" />
                </div>
                <div className="p-2">
                    {mediaKind === 'video' ? (
                        <div 
                            className="relative cursor-pointer group rounded-md overflow-hidden bg-black"
                            onClick={() => handleMediaClick({ url: msg.mediaUrl, type: 'video', caption })}
                        >
                            <video src={msg.mediaUrl} className="w-full rounded-md bg-black pointer-events-none" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    ) : mediaKind === 'audio' ? (
                        <audio src={msg.mediaUrl} controls className="w-full h-8" />
                    ) : (
                        <div 
                            className="relative cursor-pointer group rounded-md overflow-hidden"
                            onClick={() => handleMediaClick({ url: msg.mediaUrl, type: 'image', caption })}
                        >
                            <img src={msg.mediaUrl} alt="Instagram media" className="w-full max-h-[300px] object-cover rounded-md group-hover:opacity-90 transition-opacity" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    )}
                    {caption && !/^\[(image|video|audio|template)\]$/i.test(caption) && (
                        <p className="text-[14.2px] leading-snug whitespace-pre-wrap px-1 pt-2">
                            {caption}
                        </p>
                    )}
                </div>
            </div>
        );
    }
    
    if (msg.type === 'reaction' || rawBody?.reaction) {
        const emoji = rawBody?.reaction?.emoji || '❤️';
        return (
            <div className="px-3 py-1 flex items-center gap-1.5 text-slate-500 dark:text-slate-400 select-none font-sans font-semibold">
                <span className="text-xs opacity-60">Reacted</span>
                <span className="text-xl inline-block scale-110 select-all hover:scale-125 transition-transform">{emoji}</span>
            </div>
        );
    }
    
    // 1. Try to find matched template by explicit name/fields OR by content pattern matching
    let matchedTemplate = null;
    let templateName = rawBody?.template?.name || rawBody?.name;

    // Check if it's a fallback string like "Template: my_template_name (param1)"
    if (!templateName && msg.content && typeof msg.content === 'string' && msg.content.startsWith('Template: ')) {
        templateName = msg.content.substring(10).split('(')[0].trim();
    }
    
    if (msg.type === 'template' || templateName) {
        matchedTemplate = templates?.find((t: any) => t.name?.toLowerCase() === (templateName || '').toLowerCase());
    } else if (isOutbound && msg.content) {
        for (const t of (templates || [])) {
            const bodyComp = t.components?.find((c: any) => c.type?.toUpperCase() === 'BODY');
            if (!bodyComp?.text) continue;
            
            // Escape special regex characters except {{...}}
            const escapedPattern = bodyComp.text
                .replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
                .replace(/\\\{\\\{\d+\\\}\\\}/g, '.*');
                
            const regex = new RegExp(`^${escapedPattern}$`, 'i');
            if (regex.test(msg.content)) {
                matchedTemplate = t;
                break;
            }
        }
    }

    // 2. If it is a template message (either explicit or matched by content)
    if (matchedTemplate || msg.type === 'template' || templateName) {
        const componentsToUse = matchedTemplate?.components || rawBody?.template?.components || rawBody?.components || [];
        const bodyComponent = componentsToUse.find((c: any) => c.type?.toUpperCase() === 'BODY');
        const headerComponent = componentsToUse.find((c: any) => c.type?.toUpperCase() === 'HEADER');
        const footerComponent = componentsToUse.find((c: any) => c.type?.toUpperCase() === 'FOOTER');
        const buttonComponent = componentsToUse.find((c: any) => c.type?.toUpperCase() === 'BUTTONS');

        // Extract parameters to fill placeholders
        let parameters = rawBody?.template?.components?.find((c: any) => c.type?.toUpperCase() === 'BODY')?.parameters 
                        || rawBody?.components?.find((c: any) => c.type?.toUpperCase() === 'BODY')?.parameters;

        // Fallback: If parameters aren't in rawBody, but are present in the fallback string "(param1, param2)"
        if (!parameters || parameters.length === 0) {
            if (msg.content && typeof msg.content === 'string' && msg.content.includes('(') && msg.content.endsWith(')')) {
                const paramsString = msg.content.substring(msg.content.indexOf('(') + 1, msg.content.lastIndexOf(')'));
                if (paramsString) {
                    parameters = paramsString.split(',').map((p: string) => ({ text: p.trim() }));
                }
            }
        }
        parameters = parameters || [];

        let renderedBody = bodyComponent?.text || "";
        
        // If we don't have the template definition (bodyComponent.text), 
        // let's try to construct a readable version from the content string or parameters
        if (!renderedBody) {
            if (msg.content && msg.content.includes('(')) {
                // It's our preview string: "Template: name (param1, param2)"
                const contentText = msg.content.split('(')[1]?.replace(')', '') || "";
                renderedBody = contentText;
            } else if (parameters.length > 0) {
                renderedBody = parameters.map((p: any) => p.text || p.payload).join('\n');
            } else {
                renderedBody = cleanTemplateFallback(msg.content) || (templateName ? `Template: ${templateName}` : 'Template message');
            }
        } else {
            // Replace {{1}}, {{2}}... with actual parameter values
            parameters.forEach((param: any, idx: number) => {
                const value = param.text || param.payload || '';
                renderedBody = renderedBody.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), value);
            });
        }

        const resolvedHeaderMediaUrl = msg.mediaUrl || msg.media_url || rawBody?.mediaUrl || rawBody?.media_url || 
            rawBody?.template?.components?.find((c: any) => c.type?.toUpperCase() === 'HEADER')?.parameters?.[0]?.image?.link ||
            rawBody?.template?.components?.find((c: any) => c.type?.toUpperCase() === 'HEADER')?.parameters?.[0]?.image?.url ||
            rawBody?.components?.find((c: any) => c.type?.toUpperCase() === 'HEADER')?.parameters?.[0]?.image?.link ||
            rawBody?.components?.find((c: any) => c.type?.toUpperCase() === 'HEADER')?.parameters?.[0]?.image?.url ||
            rawBody?.template?.components?.find((c: any) => c.type?.toUpperCase() === 'HEADER')?.parameters?.[0]?.video?.link ||
            rawBody?.template?.components?.find((c: any) => c.type?.toUpperCase() === 'HEADER')?.parameters?.[0]?.video?.url ||
            rawBody?.components?.find((c: any) => c.type?.toUpperCase() === 'HEADER')?.parameters?.[0]?.video?.link ||
            rawBody?.components?.find((c: any) => c.type?.toUpperCase() === 'HEADER')?.parameters?.[0]?.video?.url ||
            rawBody?.template?.components?.find((c: any) => c.type?.toUpperCase() === 'HEADER')?.parameters?.[0]?.document?.link ||
            rawBody?.template?.components?.find((c: any) => c.type?.toUpperCase() === 'HEADER')?.parameters?.[0]?.document?.url ||
            rawBody?.components?.find((c: any) => c.type?.toUpperCase() === 'HEADER')?.parameters?.[0]?.document?.link ||
            rawBody?.components?.find((c: any) => c.type?.toUpperCase() === 'HEADER')?.parameters?.[0]?.document?.url ||
            headerComponent?.example?.header_handle?.[0] || "";

        return (
            <div className={cn(
                "flex flex-col min-w-[240px] max-w-[320px] rounded-lg overflow-hidden shadow-sm",
                isOutbound 
                    ? "bg-[#d9fdd3] dark:bg-[#005c4b] border border-black/5 dark:border-white/5 text-gray-900 dark:text-gray-100" 
                    : "bg-white dark:bg-[#202c33] border border-black/5 dark:border-white/5 text-gray-900 dark:text-gray-100"
            )}>
                <div className="bg-black/5 dark:bg-white/5 px-3 py-1 flex items-center justify-between border-b border-black/5">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">
                        {templateName || 'Message Template'}
                    </span>
                    <Package className="w-3 h-3 opacity-30" />
                </div>
                {headerComponent && (
                    <div className="px-3 pt-3 pb-1">
                        {headerComponent.format === 'TEXT' && <h4 className="text-[15px] font-bold">{headerComponent.text}</h4>}
                        {headerComponent.format === 'IMAGE' && (
                            <div 
                                className="relative cursor-pointer group rounded overflow-hidden"
                                onClick={() => handleMediaClick({ url: resolvedHeaderMediaUrl, type: 'image' })}
                            >
                                <img src={resolvedHeaderMediaUrl} className="w-full h-36 object-cover rounded group-hover:opacity-90 transition-opacity" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white" />
                                </div>
                            </div>
                        )}
                        {headerComponent.format === 'VIDEO' && (
                            <div 
                                className="relative cursor-pointer group rounded overflow-hidden"
                                onClick={() => handleMediaClick({ url: resolvedHeaderMediaUrl, type: 'video' })}
                            >
                                <video src={resolvedHeaderMediaUrl} className="w-full h-36 object-cover rounded" />
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                    <Play className="w-8 h-8 text-white" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <div className="px-3 py-2">
                    <p className="text-[14.2px] leading-snug whitespace-pre-wrap">
                        {renderedBody}
                    </p>
                </div>
                {footerComponent && (
                    <div className="px-3 pb-2 opacity-60">
                        <p className="text-[11px] font-medium">{footerComponent.text}</p>
                    </div>
                )}
                {buttonComponent?.buttons && (
                    <div className="border-t border-black/5 dark:border-white/5 flex flex-col divide-y divide-black/5 dark:divide-white/5">
                        {buttonComponent.buttons.map((btn: any, i: number) => (
                            <div key={i} className={cn(
                                "py-2.5 text-center font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-black/5 transition-colors cursor-default",
                                isOutbound ? "text-emerald-700 dark:text-emerald-400" : "text-primary dark:text-[#00B074]"
                            )}>
                                {btn.type === 'URL' && <ExternalLink className="w-3 h-3" />}
                                {btn.text || btn.url}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (!rawBody) {
        return (
            <div className="px-3 py-1.5 min-w-0 max-w-full overflow-hidden">
                <FormattedMessageText text={msg.content} className="text-[14.2px] leading-snug" />
            </div>
        );
    }

    // Handle Interactive Messages
    const interactive = rawBody.interactive;
    if (!interactive) {
        return (
            <div className="px-3 py-1.5 min-w-0 max-w-full overflow-hidden">
                <FormattedMessageText text={msg.content} className="text-[14.2px] leading-snug" />
            </div>
        );
    }

    const { type, header, body, footer, action } = interactive;

    return (
        <div className={cn(
            "flex flex-col min-w-[240px] max-w-[320px] rounded-lg overflow-hidden shadow-sm transition-all",
            isOutbound ? "bg-white dark:bg-[#111b21] text-gray-900 dark:text-gray-100" : "bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100"
        )}>
            {/* Header */}
            {header && (
                <div className="px-3 pt-3 pb-1">
                    {header.type === 'text' && <h4 className="text-[15px] font-bold text-[#00B074] dark:text-[#00B074]">{header.text}</h4>}
                    {header.type === 'image' && (
                        <div 
                            className="relative rounded overflow-hidden mb-1 cursor-pointer group"
                            onClick={() => handleMediaClick({ url: header.image?.link || "", type: 'image' })}
                        >
                             <img src={header.image?.link} className="w-full h-36 object-cover group-hover:opacity-90 transition-opacity" />
                             <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                 <ZoomIn className="w-5 h-5 text-white" />
                             </div>
                        </div>
                    )}
                    {header.type === 'video' && (
                        <div 
                            className="relative rounded overflow-hidden mb-1 bg-black/80 flex items-center justify-center h-36 cursor-pointer group"
                            onClick={() => handleMediaClick({ url: header.video?.link || "", type: 'video' })}
                        >
                            <FileText className="w-8 h-8 text-white opacity-40 group-hover:opacity-80 transition-opacity" />
                            <span className="absolute bottom-2 right-2 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">VIDEO</span>
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Body */}
            <div className="px-3 py-2">
                <p className="text-[14.2px] leading-snug whitespace-pre-wrap font-medium">
                    {body?.text || msg.content?.replace('[Interactive] ', '')}
                </p>
            </div>

            {/* Footer */}
            {footer && (
                <div className="px-3 pb-2 opacity-60">
                    <p className="text-[11px] font-medium tracking-tight">{footer.text}</p>
                </div>
            )}

            {/* Action Area */}
            <div className="bg-gray-50 dark:bg-black/10 border-t border-black/5 dark:border-white/5">
                {type === 'list' && (
                    <div className="flex flex-col">
                        <button 
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center justify-center gap-2 py-3 text-[#00a884] dark:text-[#00a884] font-bold text-sm cursor-pointer hover:bg-black/5 transition-colors w-full"
                        >
                            <ListFilter className="w-4 h-4" />
                            <span>{action?.button || 'View Options'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 opacity-60" /> : <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
                        </button>

                        {isExpanded && (
                            <div className="bg-white dark:bg-[#111b21] border-t border-black/5 dark:border-white/5 py-1 max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
                                {action?.sections?.map((section: any, sIdx: number) => (
                                    <div key={sIdx} className="mb-2 last:mb-0">
                                        {section.title && (
                                            <div className="px-3 py-1 bg-gray-50 dark:bg-black/20">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                                                    {section.title}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            {section.rows?.map((row: any, rIdx: number) => (
                                                <div key={row.id || rIdx} className="px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-black/20 transition-colors border-b last:border-0 border-black/5 dark:border-white/5 cursor-default group">
                                                    <p className="text-[13.5px] font-semibold text-gray-800 dark:text-gray-200 group-hover:text-primary transition-colors">
                                                        {row.title}
                                                    </p>
                                                    {row.description && (
                                                        <p className="text-[11.5px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                                                            {row.description}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {type === 'button' && (
                    <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
                        {action?.buttons?.map((btn: any) => (
                            <div key={btn.reply.id} className="py-2.5 text-center text-[#00a884] dark:text-[#00a884] font-bold text-sm cursor-default hover:bg-black/5 transition-colors flex items-center justify-center gap-2">
                                <MousePointer2 className="w-3.5 h-3.5 opacity-50" />
                                {btn.reply.title}
                            </div>
                        ))}
                    </div>
                )}

                {type === 'cta_url' && (
                    <div className="py-3 flex items-center justify-center gap-2 text-[#00a884] font-bold text-sm cursor-default hover:bg-black/5 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                        <span>
                            {typeof action?.parameters === 'string' 
                                ? JSON.parse(action.parameters).display_text 
                                : action?.parameters?.display_text || 'Open Link'}
                        </span>
                    </div>
                )}

                {type === 'flow' && (
                    <div className="py-3 flex items-center justify-center gap-2 text-[#00a884] font-bold text-sm cursor-default hover:bg-black/5 transition-colors">
                        <FileText className="w-4 h-4" />
                        <span>{action?.parameters?.flow_cta || 'Open Form'}</span>
                    </div>
                )}

                {type === 'product' && (
                    <div className="py-3 flex items-center justify-center gap-2 text-[#00a884] font-bold text-sm cursor-default hover:bg-black/5 transition-colors">
                        <ShoppingBag className="w-4 h-4" />
                        <span>View Product</span>
                    </div>
                )}

                {type === 'product_list' && (
                    <div className="flex flex-col">
                        <button 
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="py-3 flex items-center justify-center gap-2 text-[#00a884] font-bold text-sm cursor-pointer hover:bg-black/5 transition-colors w-full"
                        >
                            <Package className="w-4 h-4" />
                            <span>View Items</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 opacity-60" /> : <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
                        </button>

                        {isExpanded && (
                             <div className="bg-white dark:bg-[#111b21] border-t border-black/5 dark:border-white/5 p-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                {action?.sections?.map((section: any, sIdx: number) => (
                                    <div key={sIdx} className="mb-2 last:mb-0">
                                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 px-1">{section.title || 'Products'}</p>
                                        <div className="grid grid-cols-1 gap-1">
                                            {section.product_items?.map((item: any, pIdx: number) => (
                                                <div key={pIdx} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-black/20 rounded border border-black/5 dark:border-white/10">
                                                    <div className="w-10 h-10 bg-white dark:bg-black/20 rounded flex items-center justify-center border border-black/5 shrink-0">
                                                        <ShoppingBag className="w-4 h-4 text-[#00a884] opacity-50" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <p className="text-[12px] font-bold truncate">SKU: {item.product_retailer_id}</p>
                                                        <p className="text-[10px] opacity-60">Product from catalog</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                             </div>
                        )}
                    </div>
                )}

                {type === 'catalog_message' && (
                    <div className="py-3 flex items-center justify-center gap-2 text-[#00a884] font-bold text-sm cursor-default hover:bg-black/5 transition-colors">
                        <ShoppingBag className="w-4 h-4" />
                        <span>View Catalog</span>
                    </div>
                )}
            </div>
        </div>
    );
}
