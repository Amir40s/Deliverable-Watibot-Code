"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Loader2,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
  Video,
  X,
  Undo2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import WatiBotLoader from "@/components/WatiBotLoader";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getEmbeddableVideoUrl,
  isDirectVideoAsset,
  type TutorialVideo,
} from "@/lib/tutorial-videos";

type TutorialVideoForm = {
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
  isActive: boolean;
};

const emptyForm: TutorialVideoForm = {
  title: "",
  videoUrl: "",
  thumbnailUrl: "",
  duration: "",
  isActive: true,
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tutorial-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";

  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = String(rounded % 60).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${secs}`;
  }
  return `${minutes}:${secs}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function readVideoDuration(file: File) {
  return new Promise<string>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(formatDuration(video.duration));
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve("");
    };
    video.src = objectUrl;
  });
}

function VideoPreview({ url, title, thumbnailUrl }: { url: string; title: string; thumbnailUrl?: string }) {
  if (thumbnailUrl) {
    return (
      <div className="aspect-video w-full rounded-[20px] bg-slate-950 overflow-hidden relative">
        <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
      </div>
    );
  }

  const playerUrl = getEmbeddableVideoUrl(url);

  if (!playerUrl) {
    return (
      <div className="aspect-video w-full rounded-[20px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
        <Video className="h-8 w-8" />
      </div>
    );
  }

  if (isDirectVideoAsset(playerUrl)) {
    return (
      <video
        src={playerUrl}
        title={title}
        controls
        className="aspect-video w-full rounded-[20px] bg-slate-950 object-cover"
      />
    );
  }

  return (
    <iframe
      src={playerUrl}
      title={title}
      className="aspect-video w-full rounded-[20px] bg-slate-950"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}

export default function TutorialVideosForm() {
  const [initialVideos, setInitialVideos] = useState<TutorialVideo[]>([]);
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [form, setForm] = useState<TutorialVideoForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

  useEffect(() => {
    const loadVideos = async () => {
      try {
        const response = await fetch("/api/admin/configurations/tutorial-videos", {
          cache: "no-store",
        });

        if (!response.ok) throw new Error("Failed to load tutorial videos");

        const data = await response.json();
        const loadedVideos = Array.isArray(data.videos) ? data.videos : [];
        setVideos(loadedVideos);
        setInitialVideos(loadedVideos);
      } catch (error) {
        toast.error("Failed to load tutorial videos");
      } finally {
        setIsLoading(false);
      }
    };

    loadVideos();
  }, []);

  const hasChanges = JSON.stringify(videos) !== JSON.stringify(initialVideos);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  const persistVideos = async (nextVideos: TutorialVideo[]) => {
    setVideos(nextVideos);
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/configurations/tutorial-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videos: nextVideos }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to save tutorial videos");

      const savedVideos = Array.isArray(data.videos) ? data.videos : nextVideos;
      setVideos(savedVideos);
      setInitialVideos(savedVideos);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to save tutorial videos"));
    } finally {
      setIsSaving(false);
    }
  };

  const saveVideos = async () => {
    await persistVideos(videos);
    toast.success("Tutorial videos saved successfully");
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a valid video file");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading("Uploading video...");

    try {
      const detectedDuration = await readVideoDuration(file);
      const payload = new FormData();
      payload.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: payload,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Upload failed");

      setForm((prev) => ({
        ...prev,
        videoUrl: data.url || "",
        duration: prev.duration || detectedDuration,
      }));
      toast.success("Video uploaded successfully", { id: toastId });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Video upload failed"), { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleThumbnailUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file");
      return;
    }

    setIsUploadingThumbnail(true);
    const toastId = toast.loading("Uploading thumbnail image...");

    try {
      const payload = new FormData();
      payload.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: payload,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Thumbnail upload failed");

      setForm((prev) => ({
        ...prev,
        thumbnailUrl: data.url || "",
      }));
      toast.success("Thumbnail uploaded successfully", { id: toastId });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Thumbnail upload failed"), { id: toastId });
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleAddVideo = async () => {
    const title = form.title.trim();
    const videoUrl = form.videoUrl.trim();

    if (!title || !videoUrl) return;

    const now = new Date().toISOString();
    const nextVideo: TutorialVideo = {
      id: createId(),
      title,
      videoUrl,
      thumbnailUrl: form.thumbnailUrl.trim() || undefined,
      duration: form.duration.trim() || undefined,
      isActive: form.isActive,
      createdAt: now,
      updatedAt: now,
    };

    const nextList = [...videos, nextVideo];
    setForm(emptyForm);
    toast.success("Video added and saved!");
    await persistVideos(nextList);
  };

  const handleDelete = async (id: string) => {
    const nextList = videos.filter((video) => video.id !== id);
    toast.success("Video deleted");
    await persistVideos(nextList);
  };

  const handleToggle = async (id: string, checked: boolean) => {
    const nextList = videos.map((video) =>
      video.id === id ? { ...video, isActive: checked, updatedAt: new Date().toISOString() } : video
    );
    await persistVideos(nextList);
  };

  const handleReset = () => {
    setVideos(initialVideos);
    toast("Changes discarded");
  };

  const hasFormVideo = Boolean(form.videoUrl.trim());
  const canAdd = Boolean(form.title.trim()) && hasFormVideo && !isUploading && !isUploadingThumbnail;

  if (isLoading) {
    return <WatiBotLoader fullScreen={false} />;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-20 plus-jakarta-forced max-w-[1300px]">

      {/* Left Sidebar: Upload Form */}
      <div className="w-full lg:w-[420px] shrink-0">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden sticky top-8">
          <div className="h-1 w-full bg-[#00a884]" />

          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-[#00a884]/10 text-[#00a884] flex items-center justify-center shrink-0">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">Add Tutorial Video</h2>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                Upload videos that help users understand the dashboard.
              </p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black tracking-widest text-slate-500 dark:text-slate-400 uppercase ml-1">
                Video Title
              </label>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="e.g. Getting started with campaigns"
                className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#00a884]/40 focus:ring-4 focus:ring-[#00a884]/10 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black tracking-widest text-slate-500 dark:text-slate-400 uppercase ml-1">
                Video File / URL
              </label>
              <div
                className={cn(
                  "relative min-h-[180px] rounded-[20px] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 overflow-hidden transition-all",
                  !hasFormVideo && "hover:border-[#00a884]/50 hover:bg-[#00a884]/5"
                )}
              >
                <input
                  type="file"
                  accept="video/*"
                  className="absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed w-full h-full"
                  onChange={handleUpload}
                  disabled={isUploading}
                />
                {hasFormVideo ? (
                  <div className="relative p-3 w-full h-full flex flex-col justify-center">
                    <VideoPreview url={form.videoUrl} title={form.title || "Tutorial video"} thumbnailUrl={form.thumbnailUrl} />
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, videoUrl: "", duration: "" }))}
                      className="absolute right-5 top-5 z-20 h-8 w-8 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-rose-500 transition-colors shadow-sm"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
                    <div className="h-12 w-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-[#00a884]">
                      {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {isUploading ? "Uploading video..." : "Drag & drop or click to upload video"}
                      </p>
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                        MP4, MOV, WebM (Max 25MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail Image Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[11px] font-black tracking-widest text-slate-500 dark:text-slate-400 uppercase">
                  Thumbnail Image (Optional)
                </label>
                {form.thumbnailUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, thumbnailUrl: "" }))}
                    className="text-[10px] font-bold text-rose-500 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={form.thumbnailUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, thumbnailUrl: event.target.value }))}
                  placeholder="https://... or upload thumbnail"
                  className="flex-1 h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#00a884]/40 focus:ring-4 focus:ring-[#00a884]/10 transition-all"
                />
                <label className="h-12 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0">
                  {isUploadingThumbnail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleThumbnailUpload}
                    disabled={isUploadingThumbnail}
                  />
                </label>
              </div>
              {form.thumbnailUrl && (
                <div className="mt-2 aspect-video w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 relative shadow-sm">
                  <img src={form.thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black tracking-widest text-slate-500 dark:text-slate-400 uppercase ml-1">
                  Duration
                </label>
                <input
                  value={form.duration}
                  onChange={(event) => setForm((prev) => ({ ...prev, duration: event.target.value }))}
                  placeholder="06:45"
                  className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#00a884]/40 focus:ring-4 focus:ring-[#00a884]/10 transition-all"
                />
              </div>
              <label className="h-12 px-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-3 cursor-pointer">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
                />
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Visible</span>
              </label>
            </div>

            <Button
              type="button"
              onClick={handleAddVideo}
              disabled={!canAdd}
              className={cn(
                "w-full h-12 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2",
                canAdd
                  ? "bg-[#00a884] text-white hover:bg-[#00946f]"
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
              )}
            >
              <Plus className="h-4 w-4" />
              Add Tutorial Video
            </Button>
          </div>
        </section>
      </div>

      {/* Right Content: Published Tutorials List */}
      <div className="flex-1 min-w-0">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">

          <div className="h-1 w-full bg-slate-200 dark:bg-slate-800" />

          <div className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center justify-between p-5 px-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner bg-slate-100 dark:bg-slate-800 text-slate-500">
                <Play className="h-5 w-5 fill-current" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">Published Tutorials</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                    style={{ backgroundColor: hasChanges ? "#f59e0b" : "#10b981" }}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {hasChanges ? "Unsaved Changes" : "All Changes Saved"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {hasChanges && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="rounded-xl h-10 px-4 text-xs font-bold border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Undo2 className="w-3.5 h-3.5 mr-2" />
                  Discard
                </Button>
              )}
              <Button
                onClick={saveVideos}
                disabled={!hasChanges || isSaving}
                className={cn(
                  "rounded-xl h-10 px-6 text-xs font-bold shadow-sm transition-all",
                  hasChanges && !isSaving
                    ? "bg-[#00a884] text-white hover:bg-[#00946f]"
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                )}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>

          <div className="p-8">
            {videos.length === 0 ? (
              <div className="min-h-[300px] rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-col items-center justify-center text-center p-8">
                <div className="h-16 w-16 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-400 mb-4">
                  <Video className="h-8 w-8" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">No tutorial videos uploaded yet.</h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
                  Use the form on the left to add your first video. Once saved, it will be visible in the user dashboard tutorial section.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm flex flex-col gap-4 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="overflow-hidden rounded-[20px] bg-slate-950 shrink-0">
                      <VideoPreview url={video.videoUrl} title={video.title} thumbnailUrl={video.thumbnailUrl} />
                    </div>

                    <div className="flex flex-col gap-4 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug line-clamp-2">
                            {video.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1.5">
                            {video.duration && (
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md">
                                {video.duration}
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border-none",
                                video.isActive
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              )}
                            >
                              {video.isActive ? "Visible" : "Hidden"}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-4 flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <Switch
                            checked={video.isActive}
                            onCheckedChange={(checked) => handleToggle(video.id, checked)}
                          />
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">
                            Visible on user dashboard
                          </span>
                        </label>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => window.open(video.videoUrl, "_blank", "noopener,noreferrer")}
                            className="h-8 w-8 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-[#00a884] flex items-center justify-center transition-colors"
                            title="Preview Video"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(video.id)}
                            className="h-8 w-8 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                            title="Delete Video"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
