import { memo, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Settings2, Loader2, CheckCircle2, Keyboard, MessageSquare, MessageCircle, Camera } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getInstagramActiveStories } from '@/app/actions/instagram-page';
import { getAdAccounts, getAdCampaigns } from '@/app/actions/facebook-ads';

export const TriggerNode = memo(({ id, data, selected }: NodeProps) => {
  const { setNodes } = useReactFlow();
  const t = useTranslations("FlowEditor.trigger");
  const tNodes = useTranslations("FlowEditor.nodes");
  const [keyword, setKeyword] = useState(data.keyword || '');
  const [matchMode, setMatchMode] = useState(data.matchMode || 'contains');
  const [stories, setStories] = useState<any[]>([]);
  const [isLoadingStories, setIsLoadingStories] = useState(false);
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(false);

  const triggerType = data.triggerType || 'keyword';
  const selectedStoryIds = data.selectedStoryIds || [];

  useEffect(() => {
    if (triggerType === 'story_reply' && stories.length === 0) {
      fetchStories();
    }
  }, [triggerType]);

  const fetchStories = async () => {
    setIsLoadingStories(true);
    try {
      const data = await getInstagramActiveStories();
      setStories(data);
    } catch (err) {
      console.error('Failed to fetch stories:', err);
    } finally {
      setIsLoadingStories(false);
    }
  };

  useEffect(() => {
    if (triggerType === 'keyword') {
      loadAdAccounts();
    }
  }, [triggerType]);

  useEffect(() => {
    if (data.facebookAdAccountId) {
      loadAds(data.facebookAdAccountId);
    }
  }, [data.facebookAdAccountId]);

  const loadAdAccounts = async () => {
    try {
      const accounts = await getAdAccounts();
      if (accounts && accounts.length > 0) {
        setAdAccounts(accounts);
        if (!data.facebookAdAccountId) {
          updateNodeData({ facebookAdAccountId: accounts[0].id });
        }
      }
    } catch (error) {
      console.error('Failed to load ad accounts:', error);
      // Fallback
      if (adAccounts.length === 0) {
        const dummyAccounts = [{ id: 'act_dummy1', name: 'Dummy Ad Account 1' }];
        setAdAccounts(dummyAccounts);
        if (!data.facebookAdAccountId) {
          updateNodeData({ facebookAdAccountId: dummyAccounts[0].id });
        }
      }
    }
  };

  const loadAds = async (accountId: string) => {
    setIsLoadingAds(true);
    try {
      const campaigns = await getAdCampaigns(accountId);
        const extractedAds: any[] = [];
        campaigns.forEach((camp: any) => {
          if (camp.adsets && camp.adsets.data) {
            camp.adsets.data.forEach((adset: any) => {
              if (adset.ads && adset.ads.data) {
                adset.ads.data.forEach((ad: any) => {
                  extractedAds.push({ id: ad.id, name: ad.name });
                });
              }
            });
          }
        });
        setAds(extractedAds);
    } catch (error) {
      console.error('Failed to load ads:', error);
       if (ads.length === 0) {
        setAds([
          { id: 'ad_1', name: 'Summer Sale Campaign - Image Ad' },
          { id: 'ad_2', name: 'Retargeting Video Ad' },
          { id: 'ad_3', name: 'Lead Gen Form Ad' }
        ]);
      }
    } finally {
      setIsLoadingAds(false);
    }
  };

  const updateNodeData = (newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  const toggleStorySelection = (storyId: string) => {
    const nextIds = selectedStoryIds.includes(storyId)
      ? selectedStoryIds.filter((id: string) => id !== storyId)
      : [...selectedStoryIds, storyId];
    updateNodeData({ selectedStoryIds: nextIds });
  };

  return (
    <>
      <div className={cn(
        "relative group/node w-[300px] bg-[#F1F3F2] dark:bg-slate-800 p-2.5 rounded-[24px] border-[6px] border-[#00B074] shadow-xl transition-all ",
        selected ? "ring-4 ring-[#00B074]/30" : ""
      )}>
        {/* Header Pill */}
        <div className="bg-white dark:bg-slate-900 rounded-full px-4 py-2.5 flex items-center justify-between mb-3 relative shadow-sm">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-[#00B074]" />
            <span className="font-medium text-[#00B074] text-[15px]">{tNodes("flowStart")}</span>
          </div>
          <div className="w-5 h-5 flex items-center justify-center relative mr-[-4px]">
            <Handle
              type="source"
              position={Position.Right}
              className="w-4! h-4! border-[3px]! border-[#00B074]! bg-white! dark:bg-slate-900! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! opacity-100! z-50! cursor-crosshair!"
              style={{ pointerEvents: 'all' }}
            />
          </div>
        </div>

        <div className="space-y-4 px-1 nodrag nopan">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block px-1">{t("triggerType")}</label>
            <div className="flex gap-1.5 p-1 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-white/50 dark:border-slate-700/50">
              {[
                { id: 'keyword', label: 'Keyword', icon: <Keyboard className="w-6 h-6 stroke-[1.5]" /> },
                ...(data.platform === 'FACEBOOK_COMMENT' ? [{ id: 'facebook_comment', label: 'FB Comment', icon: <MessageSquare className="w-6 h-6 stroke-[1.5]" /> }] : []),
                ...(data.platform === 'INSTAGRAM_COMMENT' ? [{ id: 'instagram_comment', label: 'IG Comment', icon: <MessageCircle className="w-6 h-6 stroke-[1.5]" /> }] : []),
                ...(data.platform === 'INSTAGRAM_STORY_REPLY' ? [{ id: 'story_reply', label: 'Story', icon: <Camera className="w-6 h-6 stroke-[1.5]" /> }] : [])
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    updateNodeData({ triggerType: t.id });
                  }}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center py-2 gap-1.5 rounded-lg transition-all border border-transparent",
                    (triggerType === t.id || (t.id === 'webhook' && (triggerType === 'shopify_event' || triggerType === 'woocommerce_event'))) 
                      ? "bg-white dark:bg-slate-800 text-[#00B074] shadow-sm border-slate-100 dark:border-slate-700" 
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  )}
                >
                  <div className="flex items-center justify-center h-8">
                    {t.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {triggerType === 'keyword' && (
            <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
              {triggerType === 'keyword' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block px-1 mb-1.5">{t("keywords")}</label>
                  <Input
                    placeholder={t("keywordsHint")}
                    value={keyword}
                    onChange={(e) => {
                      setKeyword(e.target.value);
                      updateNodeData({ keyword: e.target.value });
                    }}
                    className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-700 h-10 rounded-xl text-[13px] shadow-sm focus-visible:ring-[#00B074]"
                  />
                </div>
              )}
              {triggerType === 'keyword' && (
                <div className="flex gap-1.5 p-1 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-white/50 dark:border-slate-700/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMatchMode('whole');
                      updateNodeData({ matchMode: 'whole' });
                    }}
                    className={cn("flex-1 h-8 text-[11px] font-bold rounded-lg transition-all", matchMode === 'whole' ? "bg-[#00B074] text-white shadow-sm" : "text-slate-500 hover:bg-white dark:hover:bg-slate-800")}
                  >
                    {t("whole")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMatchMode('contains');
                      updateNodeData({ matchMode: 'contains' });
                    }}
                    className={cn("flex-1 h-8 text-[11px] font-bold rounded-lg transition-all", matchMode === 'contains' ? "bg-[#00B074] text-white shadow-sm" : "text-slate-500 hover:bg-white dark:hover:bg-slate-800")}
                  >
                    {t("contains")}
                  </Button>
                </div>
              )}

              {triggerType === 'keyword' && (
                <div className="space-y-2 mt-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block px-1 mb-1">Choose Ad Account</label>
                    <select
                      className="w-full h-8 px-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#00B074]"
                      value={data.facebookAdAccountId || ""}
                      onChange={(e) => updateNodeData({ facebookAdAccountId: e.target.value, facebookAdId: "" })}
                    >
                      <option value="">Select Ad Account</option>
                      {adAccounts.map((acc: any) => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block px-1 mb-1">Choose Facebook Ad</label>
                    <select
                      className="w-full h-8 px-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#00B074]"
                      value={data.facebookAdId || ""}
                      onChange={(e) => updateNodeData({ facebookAdId: e.target.value })}
                      disabled={isLoadingAds}
                    >
                      <option value="">{isLoadingAds ? "Loading ads..." : "Select Facebook Ad"}</option>
                      {ads.map((ad: any) => (
                        <option key={ad.id} value={ad.id}>{ad.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
});

TriggerNode.displayName = 'TriggerNode';

