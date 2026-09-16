import { useTranslations } from "next-intl";

import { useState } from "react";
import {
    MessageSquare,
    MessageSquareText,
    Image,
    List,
    LayoutList,
    ShoppingBag,
    Box,
    Layers,
    Zap,
    UserPlus,
    BarChart2,
    GitBranch,
    Share2,
    MapPin,
    Navigation,
    HelpCircle,
    FileVideo,
    Tag,
    Globe,
    Bot,
    ChevronLeft,
    ChevronRight,
    Database,
    type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export function EditorSidebar({
    onNodeAdd,
    platform = 'WHATSAPP'
}: {
    onNodeAdd: (type: string) => void;
    platform?: string;
}) {
    const [isOpen, setIsOpen] = useState(true);
    const t = useTranslations("FlowEditor");

    const isWhatsApp = platform === 'WHATSAPP' || platform === 'ALL' || platform === 'SHOPIFY';
    const isShopify = platform === 'SHOPIFY';
    const isFBInstagram = ['FACEBOOK', 'FACEBOOK_COMMENT', 'INSTAGRAM', 'INSTAGRAM_COMMENT'].includes(platform);

    return (
        <TooltipProvider delayDuration={0}>
            <div className={cn(
                "relative h-full flex flex-col shrink-0 transition-all duration-300 ease-in-out border-r border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900",
                isOpen ? "w-[280px]" : "w-0 border-r-0"
            )}>
                {/* Toggle Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "absolute top-6 z-50 w-6 h-6 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow cursor-pointer",
                        isOpen ? "-right-3" : "-right-10"
                    )}
                >
                    {isOpen ? (
                        <ChevronLeft className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                    ) : (
                        <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                    )}
                </button>

                <div className={cn("w-full h-full overflow-y-auto", !isOpen && "hidden")}>
                    {/* Message Types Section */}
                    <div className="p-6 pb-0">
                        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">{t("messageTypes")}</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <SidebarItem icon={MessageSquare} type="message" label={t("nodes.message")} onNodeAdd={onNodeAdd} />
                            <SidebarItem icon={MessageSquareText} type="quick-reply" label="Quick Reply" onNodeAdd={onNodeAdd} tooltipText="Select a Quick Reply to send" />
                            <SidebarItem icon={Image} type="media-buttons" label={t("nodes.mediaButtons")} onNodeAdd={onNodeAdd} />
                            
                            {isFBInstagram && (
                                <>
                                    <SidebarItem icon={Layers} type="carousel" label={t("nodes.carousel")} onNodeAdd={onNodeAdd} />
                                    <SidebarItem icon={MessageSquare} type="public-reply" label={t("nodes.publicReply")} onNodeAdd={onNodeAdd} />
                                </>
                            )}
                            
                            {isWhatsApp && (
                                <>
                                    <SidebarItem icon={List} type="list" label={t("nodes.list")} onNodeAdd={onNodeAdd} />
                                    <SidebarItem icon={LayoutList} type="whatsapp-forms" label={t("nodes.whatsappForms")} onNodeAdd={onNodeAdd} />
                                    <SidebarItem icon={ShoppingBag} type="catalogue-message" label={t("nodes.catalogueMessage")} onNodeAdd={onNodeAdd} />
                                    <SidebarItem icon={Box} type="single-product" label={t("nodes.singleProduct")} onNodeAdd={onNodeAdd} />
                                    <SidebarItem icon={Layers} type="multi-product" label={t("nodes.multiProduct")} onNodeAdd={onNodeAdd} />
                                    <SidebarItem icon={Zap} type="template" label={t("nodes.template")} onNodeAdd={onNodeAdd} />
                                </>
                            )}
                        </div>
                    </div>

                    {isShopify && (
                        <div className="p-6 pb-0">
                            <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                                <ShoppingBag className="w-4 h-4" /> Shopify Tools
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <SidebarItem icon={MessageSquare} type="ask-order-number" label={t("nodes.orderInfo")} onNodeAdd={onNodeAdd} tooltipText="Ask customer for order number" />
                                <SidebarItem icon={Box} type="order-info" label={t("nodes.orderInfo")} onNodeAdd={onNodeAdd} tooltipText="Display order details" />
                                <SidebarItem icon={Zap} type="shopify-action" label={t("nodes.shopifyAction")} onNodeAdd={onNodeAdd} tooltipText="Perform shopify actions" />
                            </div>
                        </div>
                    )}

                    {/* Actions Section */}
                    <div className="p-6">
                        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">{t("actions")}</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <SidebarItem icon={UserPlus} type="request-intervention" label={t("nodes.requestIntervention")} onNodeAdd={onNodeAdd} />
                            <SidebarItem icon={BarChart2} type="conversions-api" label={`Meta ${t("nodes.conversionsAPI")}`} onNodeAdd={onNodeAdd} />
                            <SidebarItem icon={GitBranch} type="condition" label={t("nodes.condition")} onNodeAdd={onNodeAdd} />
                            {isWhatsApp && (
                                <>
                                    <SidebarItem icon={MapPin} type="ask-address" label={t("nodes.askAddress")} onNodeAdd={onNodeAdd} />
                                    <SidebarItem icon={Navigation} type="ask-location" label={t("nodes.askLocation")} onNodeAdd={onNodeAdd} />
                                </>
                            )}
                            <SidebarItem icon={HelpCircle} type="ask-question" label={t("nodes.askQuestion")} onNodeAdd={onNodeAdd} />
                            <SidebarItem icon={FileVideo} type="ask-media" label={t("nodes.askMedia")} onNodeAdd={onNodeAdd} />
                            <SidebarItem icon={MessageSquareText} type="set-attribute" label={t("nodes.setAttribute")} onNodeAdd={onNodeAdd} />
                            <SidebarItem icon={Tag} type="add-tag" label={t("nodes.addTag")} onNodeAdd={onNodeAdd} />
                            <SidebarItem
                                icon={Globe}
                                type="api-request"
                                label={t("nodes.aPIRequest")}
                                className="text-[#00B074]"
                                onNodeAdd={onNodeAdd}
                                tooltipText="Trigger a Webhook or perform custom API Request"
                            />
                        </div>
                    </div>

                    <div className="p-6 pt-0">
                        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">{t("integrations")}</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <SidebarItem
                                icon={Database}
                                type="google-sheets"
                                label={t("nodes.googleSheets")}
                                className="text-emerald-600"
                                onNodeAdd={onNodeAdd}
                            />
                            <SidebarItem
                                icon={Bot}
                                type="ai-knowledge"
                                label={t("nodes.aIKnowledge") || "AI Knowledge"}
                                className="text-indigo-600"
                                onNodeAdd={onNodeAdd}
                                tooltipText="AI Knowledge Base integration"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}

function SidebarItem({
    icon: Icon,
    type,
    label,
    className,
    onNodeAdd,
    disabled = false,
    tooltipText = "Drag to add or tap"
}: {
    icon: LucideIcon,
    type: string,
    label: string,
    className?: string,
    onNodeAdd: (type: string) => void,
    disabled?: boolean,
    tooltipText?: string
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    className={cn(
                        "relative flex flex-col items-center justify-center p-4 h-[90px] border border-gray-100 dark:border-slate-800 rounded-2xl transition-all bg-white dark:bg-slate-900 group",
                        disabled
                            ? "cursor-default border-gray-100 dark:opacity-50"
                            : "hover:border-emerald-500/50 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 hover:shadow-sm cursor-grab active:cursor-grabbing"
                    )}
                    draggable={!disabled}
                    onDragStart={(event) => {
                        if (disabled) {
                            event.preventDefault();
                            return;
                        }
                        event.dataTransfer.setData('application/reactflow', type);
                        event.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={() => !disabled && onNodeAdd(type)}
                >
                    <div className={cn("flex flex-col items-center transition-transform group-hover:scale-110", disabled && "opacity-40 grayscale")}>
                        <Icon className={cn("w-6 h-6 mb-2 text-[#00B074] dark:text-emerald-500 stroke-[1.5]", className)} />
                        <span className="text-[10px] text-center font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 leading-tight px-1 ">{label}</span>
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent
                side="top"
                className="bg-gray-900 dark:bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest border-none shadow-xl z-[9999] px-3 py-1.5"
            >
                <p>{tooltipText}</p>
            </TooltipContent>
        </Tooltip>
    );
}
