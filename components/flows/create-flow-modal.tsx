"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createFlow } from "@/app/actions/flows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations, useLocale } from "next-intl";

export function CreateFlowModal() {
  const router = useRouter();
  const t = useTranslations("CreateFlowModal");
  const locale = useLocale();
  const dir = ["ar", "ur", "hi", "bn"].includes(locale) ? "rtl" : "ltr";

  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    platform: "WHATSAPP",
  });
  const [stories, setStories] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoadingStories, setIsLoadingStories] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchContent = async () => {
      if (formData.platform === "INSTAGRAM_STORY_REPLY" && stories.length === 0) {
        setIsLoadingStories(true);
        try {
          const { getInstagramActiveStories } = await import("@/app/actions/instagram-page");
          const data = await getInstagramActiveStories();
          setStories(data);
        } catch (err) {
          console.error("Failed to fetch stories:", err);
        } finally {
          setIsLoadingStories(false);
        }
      } else if (formData.platform === "FACEBOOK_COMMENT" && posts.length === 0) {
        setIsLoadingPosts(true);
        try {
          const { getConnectedFacebookPagePosts } = await import("@/app/actions/facebook-page");
          const data = await getConnectedFacebookPagePosts(30);
          setPosts(data.posts);
        } catch (err) {
          console.error("Failed to fetch FB posts:", err);
        } finally {
          setIsLoadingPosts(false);
        }
      } else if (formData.platform === "INSTAGRAM_COMMENT" && posts.length === 0) {
        setIsLoadingPosts(true);
        try {
          const { getConnectedInstagramAccountData } = await import("@/app/actions/instagram-page");
          const data = await getConnectedInstagramAccountData(30);
          setPosts(data.media);
        } catch (err) {
          console.error("Failed to fetch IG posts:", err);
        } finally {
          setIsLoadingPosts(false);
        }
      }
    };
    fetchContent();
  }, [formData.platform]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error(t("errorNoName"));
      return;
    }

    setIsLoading(true);
    try {
      const result = await createFlow({
        name: formData.name,
        description: formData.description,
        platform: formData.platform,
        selectedStoryIds:
          formData.platform === "INSTAGRAM_STORY_REPLY" ? selectedStoryIds : [],
        selectedPostIds:
          ["FACEBOOK_COMMENT", "INSTAGRAM_COMMENT"].includes(formData.platform) ? selectedPostIds : [],
      });

      if (result.success && result.flow) {
        toast.success(t("successCreated"));
        router.push(`/dashboard/flows/${result.flow.id}`);
      } else {
        toast.error(result.error || t("errorCreate"));
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Flow creation error:", error);
      toast.error(
        error instanceof Error ? error.message : t("errorCreate"),
      );
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push("/dashboard/flows");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-[500px]" dir={dir}>
        <DialogHeader className={dir === "rtl" ? "text-right" : "text-left"}>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="overflow-visible flex flex-col max-h-[85vh]"
        >
          <style
            dangerouslySetInnerHTML={{
              __html: `
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `,
            }}
          />
          <div className="flex-1 overflow-y-auto px-1 py-6 space-y-6 hide-scrollbar">
            {/* Flow Name */}
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className={`text-sm font-medium text-gray-700 flex items-center gap-1 ${dir === "rtl" ? "flex-row-reverse justify-end" : ""}`}
              >
                <span className="text-red-500">*</span>
                {t("flowName")}
              </Label>

              <Input
                id="name"
                placeholder={t("flowNamePlaceholder")}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className={`h-11 border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all duration-200 ${dir === "rtl" ? "text-right" : "text-left"}`}
                dir={dir}
                autoFocus
              />

              <p className={`text-xs text-gray-500 ${dir === "rtl" ? "text-right" : "text-left"}`}>
                {t("flowNameHint")}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label
                htmlFor="description"
                className={`text-sm font-medium text-gray-700 flex items-center gap-1 ${dir === "rtl" ? "flex-row-reverse justify-end" : ""}`}
              >
                <span className="text-gray-400 text-xs">({t("optional")})</span>
                {t("descriptionLabel")}
              </Label>

              <Textarea
                id="description"
                placeholder={t("descriptionPlaceholder")}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className={`min-h-[100px] border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all duration-200 resize-none ${dir === "rtl" ? "text-right" : "text-left"}`}
                dir={dir}
              />

              <p className={`text-xs text-gray-500 ${dir === "rtl" ? "text-right" : "text-left"}`}>
                {t("descriptionHint")}
              </p>
            </div>

            {/* Platform Selection */}
            <div className="space-y-2">
              <Label
                htmlFor="platform"
                className={`text-sm font-medium text-gray-700 flex items-center gap-1 ${dir === "rtl" ? "flex-row-reverse justify-end" : ""}`}
              >
                <span className="text-red-500">*</span>
                {t("targetPlatform")}
              </Label>

              <Select
                value={formData.platform}
                dir={dir}
                onValueChange={(value) =>
                  setFormData({ ...formData, platform: value })
                }
              >
                <SelectTrigger className="h-11 border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all duration-200">
                  <SelectValue placeholder={t("selectPlatform")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("allPlatforms")}</SelectItem>
                  <SelectItem value="WHATSAPP">{t("whatsapp")}</SelectItem>
                  <SelectItem value="FACEBOOK">{t("facebookInbox")}</SelectItem>
                  <SelectItem value="FACEBOOK_COMMENT">
                    {t("facebookComment")}
                  </SelectItem>
                  <SelectItem value="INSTAGRAM">{t("instagramInbox")}</SelectItem>
                  <SelectItem value="INSTAGRAM_COMMENT">
                    {t("instagramComment")}
                  </SelectItem>
                  <SelectItem value="INSTAGRAM_STORY_REPLY">
                    {t("instagramStoryReply")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className={`text-xs text-gray-500 ${dir === "rtl" ? "text-right" : "text-left"}`}>
                {t("platformHint")}
              </p>
            </div>

            {formData.platform === "INSTAGRAM_STORY_REPLY" && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className={`flex items-center justify-between ${dir === "rtl" ? "flex-row-reverse" : ""}`}>
                  <Label className="text-sm font-medium text-gray-700">
                    {t("selectStories")}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      setIsLoadingStories(true);
                      try {
                        const { getInstagramActiveStories } =
                          await import("@/app/actions/instagram-page");
                        const data = await getInstagramActiveStories();
                        setStories(data);
                      } finally {
                        setIsLoadingStories(false);
                      }
                    }}
                    className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    {t("refreshStories")}
                  </Button>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-[220px] overflow-y-auto hide-scrollbar">
                  {isLoadingStories ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3 text-gray-400">
                      <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">{t("loadingStories")}</span>
                    </div>
                  ) : stories.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {stories.map((story) => (
                        <button
                          key={story.id}
                          type="button"
                          onClick={() => {
                            const nextIds = selectedStoryIds.includes(story.id)
                              ? selectedStoryIds.filter((id) => id !== story.id)
                              : [...selectedStoryIds, story.id];
                            setSelectedStoryIds(nextIds);
                          }}
                          className={`relative aspect-[9/16] rounded-lg overflow-hidden border-2 transition-all ${
                            selectedStoryIds.includes(story.id)
                              ? "border-green-600 ring-2 ring-green-100"
                              : "border-transparent opacity-70 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={story.thumbnail_url || story.media_url}
                            alt="Story"
                            className="w-full h-full object-cover"
                          />
                          {selectedStoryIds.includes(story.id) && (
                            <div className="absolute inset-0 bg-green-600/20 flex items-center justify-center">
                              <div className="bg-white rounded-full p-0.5 shadow-lg">
                                <svg
                                  className="w-4 h-4 text-green-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="3"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-xs text-gray-500">
                        {t("noStories")}
                      </p>
                    </div>
                  )}
                </div>

                <p className={`text-[11px] text-gray-500 italic ${dir === "rtl" ? "text-right" : "text-left"}`}>
                  {selectedStoryIds.length > 0
                    ? t("storiesSelectedCount", { count: selectedStoryIds.length })
                    : t("noStoriesSelected")}
                </p>
              </div>
            )}

            {/* Post Selection for Comment Automation */}
            {(formData.platform === "FACEBOOK_COMMENT" || formData.platform === "INSTAGRAM_COMMENT") && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className={`flex items-center justify-between ${dir === "rtl" ? "flex-row-reverse" : ""}`}>
                  <Label className="text-sm font-medium text-gray-700">
                    {t("selectPosts")}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      setIsLoadingPosts(true);
                      try {
                        if (formData.platform === "FACEBOOK_COMMENT") {
                          const { getConnectedFacebookPagePosts } = await import("@/app/actions/facebook-page");
                          const data = await getConnectedFacebookPagePosts(30);
                          setPosts(data.posts);
                        } else {
                          const { getConnectedInstagramAccountData } = await import("@/app/actions/instagram-page");
                          const data = await getConnectedInstagramAccountData(30);
                          setPosts(data.media);
                        }
                      } finally {
                        setIsLoadingPosts(false);
                      }
                    }}
                    className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    {t("refreshPosts")}
                  </Button>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-[220px] overflow-y-auto hide-scrollbar">
                  {isLoadingPosts ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3 text-gray-400">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">{t("loadingPosts")}</span>
                    </div>
                  ) : posts.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {posts.map((post) => (
                        <button
                          key={post.id}
                          type="button"
                          onClick={() => {
                            const nextIds = selectedPostIds.includes(post.id)
                              ? selectedPostIds.filter((id) => id !== post.id)
                              : [...selectedPostIds, post.id];
                            setSelectedPostIds(nextIds);
                          }}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            selectedPostIds.includes(post.id)
                              ? "border-blue-600 ring-2 ring-blue-100"
                              : "border-transparent opacity-70 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={post.full_picture || post.media_url || "https://placehold.co/100x100?text=Post"}
                            alt="Post"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-black/40 p-1">
                             <p className="text-[8px] text-white truncate">{post.message || post.caption || t("noCaption")}</p>
                          </div>
                          {selectedPostIds.includes(post.id) && (
                            <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                              <div className="bg-white rounded-full p-0.5 shadow-lg">
                                <svg
                                  className="w-4 h-4 text-blue-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="3"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-xs text-gray-500">
                        {t("noPosts", { platform: formData.platform === "FACEBOOK_COMMENT" ? t("facebookPage") : t("instagram") })}
                      </p>
                    </div>
                  )}
                </div>

                <p className={`text-[11px] text-gray-500 italic ${dir === "rtl" ? "text-right" : "text-left"}`}>
                  {selectedPostIds.length > 0
                    ? t("postsSelectedCount", { count: selectedPostIds.length })
                    : t("noPostsSelected")}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className={`pt-4 border-t border-gray-100 ${dir === "rtl" ? "flex-row-reverse" : ""}`}>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-[#00B074] hover:bg-[#009662] text-white"
            >
              {isLoading ? t("creating") : t("createFlow")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
