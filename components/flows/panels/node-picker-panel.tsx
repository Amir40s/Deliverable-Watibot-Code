import { useTranslations } from 'next-intl';
import { X, MessageSquare, Image, List, LayoutList, ShoppingBag, Box, Layers, Zap, UserPlus, BarChart2, GitBranch, MapPin, Navigation, HelpCircle, FileVideo, type LucideIcon } from 'lucide-react';

interface NodePickerPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: string) => void;
    platform?: string;
}

// Keeping icons and types, labels will be handled by translation
const messageTypes = [
    { icon: MessageSquare, tKey: 'message', type: 'message' },
    { icon: Image, tKey: 'mediaButtons', type: 'media' },
    { icon: List, tKey: 'list', type: 'list', whatsappOnly: true },
    { icon: LayoutList, tKey: 'whatsappForms', type: 'whatsapp_forms', whatsappOnly: true },
    { icon: ShoppingBag, tKey: 'catalogueMessage', type: 'catalogue', whatsappOnly: true },
    { icon: Box, tKey: 'singleProduct', type: 'single_product', whatsappOnly: true },
    { icon: Layers, tKey: 'multiProduct', type: 'multi_product', whatsappOnly: true },
    { icon: Zap, tKey: 'template', type: 'template', whatsappOnly: true },
    { icon: Layers, label: 'Carousel', type: 'carousel' },
];

const actions = [
    { icon: BarChart2, label: 'Meta Conversions API', type: 'conversions-api' },
    { icon: GitBranch, label: 'Condition', type: 'condition' },
    { icon: MapPin, label: 'Ask Address', type: 'ask_address' },
    { icon: Navigation, label: 'Ask Location', type: 'ask_location' },
    { icon: HelpCircle, label: 'Ask Question', type: 'ask_question' },
    { icon: FileVideo, label: 'Ask Media', type: 'ask_media' },
    { icon: UserPlus, label: 'Request Intervention', type: 'request_intervention' },
];

function NodeItem({ icon: Icon, label, type, onSelect }: { icon: LucideIcon; label: string; type: string; onSelect: (type: string) => void }) {
    return (
        <button
            onClick={() => onSelect(type)}
            className="flex flex-col items-center justify-center p-3 h-[80px] border border-gray-100 dark:border-slate-700 rounded-2xl transition-all bg-white dark:bg-slate-800 hover:border-emerald-500/50 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 hover:shadow-sm group"
        >
            <Icon className="w-5 h-5 mb-1.5 text-[#00B074] dark:text-emerald-500 stroke-[1.5] group-hover:scale-110 transition-transform" />
            <span className="text-[9px] text-center font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 leading-tight">
                {label}
            </span>
        </button>
    );
}

export function NodePickerPanel({ isOpen, onClose, onSelect, platform }: NodePickerPanelProps) {
    const t = useTranslations("FlowEditor");

    if (!isOpen) return null;

    const isInstagram = platform?.includes('INSTAGRAM');

    const handleSelect = (type: string) => {
        onSelect(type);
        onClose();
    };

    const filteredMessageTypes = messageTypes.filter(item => !isInstagram || !item.whatsappOnly);

    return (
        <div
            className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[340px] max-h-[80vh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-2 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2 sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 z-10">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Add Next Node</span>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 space-y-5">
                    {/* Message Types */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 px-1">{t("messageTypes")}</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {filteredMessageTypes.map((item) => (
                                <NodeItem key={item.type} icon={item.icon} type={item.type} label={item.tKey ? t(`nodes.${item.tKey}`) : (item.label || '')} onSelect={handleSelect} />
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 px-1">{t("actions")}</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {actions.map((item) => (
                                <NodeItem key={item.type} {...item} onSelect={handleSelect} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
