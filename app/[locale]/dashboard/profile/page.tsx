"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2, Upload, Plus, Image as ImageIcon, Info, Trash2, Building, User, Loader2 ,File} from "lucide-react";
import { getMetaProfile, updateMetaProfile, updateProfile, updateOrganizationName } from "./actions";
import { toast } from "sonner";
import { PillButton } from "@/components/ui/pill-button";

const ACCENT = "#00B074";

function initials(name: string | null | undefined): string {
 if (!name?.trim()) return "?";
 const parts = name.trim().split(/\s+/);
 if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
 return name.slice(0, 2).toUpperCase();
}

export default function MetaProfilePage() {
 const { data: session, update: updateSession } = useSession();
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);

 // Form State
 const [businessAddress, setBusinessAddress] = useState("");
 const [businessDescription, setBusinessDescription] = useState("");
 const [businessEmail, setBusinessEmail] = useState("");
 const [businessVertical, setBusinessVertical] = useState("");
 const [businessWebsite, setBusinessWebsite] = useState("");
 const [websites, setWebsites] = useState<string[]>([]);
 const [currentDisplayName, setCurrentDisplayName] = useState("");
 
 // Photo State
 const [businessLogo, setBusinessLogo] = useState<string | null>(null);
 const [isUploadingLogo, setIsUploadingLogo] = useState(false);
 const businessLogoRef = useRef<HTMLInputElement>(null);

 // Personal Info State
 const [name, setName] = useState("");
 const [email, setEmail] = useState("");
 const [userImage, setUserImage] = useState<string | null>(null);
 const [isUploadingUserImage, setIsUploadingUserImage] = useState(false);
 const userImageRef = useRef<HTMLInputElement>(null);

 const [organizationName, setOrganizationName] = useState("");
 const [personalError, setPersonalError] = useState<string | null>(null);

 useEffect(() => {
 async function loadData() {
 setLoading(true);
 try {
 // Load Meta Profile Data
 const data = await getMetaProfile();
 if (data) {
 setBusinessAddress(data.businessAddress || "");
 setBusinessDescription(data.businessDescription || "");
 setBusinessEmail(data.businessEmail || "");
 setBusinessVertical(data.businessVertical || "");
 setWebsites(data.businessWebsites || []);
 setBusinessLogo(data.businessLogo || null);
 setCurrentDisplayName(data.whatsappBusinessName || "");
 }
 } catch (error) {
 console.error("Failed to load meta profile", error);
 } finally {
 setLoading(false);
 }
 }
 loadData();
 }, []);

 useEffect(() => {
 if (session?.user) {
 setName(session.user.name ?? "");
 setEmail(session.user.email ?? "");
 setUserImage(session.user.image ?? null);
 setOrganizationName(session.user.organizationName ?? "");
 }
 }, [session?.user?.name, session?.user?.email, session?.user?.image, session?.user?.organizationName]);

 const handleAddWebsite = () => {
 if (businessWebsite.trim()) {
 setWebsites([...websites, businessWebsite.trim()]);
 setBusinessWebsite("");
 }
 };

 const handleRemoveWebsite = (index: number) => {
 setWebsites(websites.filter((_, i) => i !== index));
 };

 const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type:'user' |'business') => {
 const file = e.target.files?.[0];
 if (!file) return;

 const isUser = type ==='user';
 const setter = isUser ? setUserImage : setBusinessLogo;
 const loader = isUser ? setIsUploadingUserImage : setIsUploadingLogo;

 loader(true);
 const toastId = toast.loading(`Uploading ${isUser ?'profile photo' :'business logo'}...`);

 try {
 const formData = new FormData();
 formData.append('file', file);

 const response = await fetch('/api/upload', {
 method:'POST',
 body: formData
 });

 if (!response.ok) throw new Error('Upload failed');

 const { url } = await response.json();
 setter(url);
 toast.success("Upload successful", { id: toastId });
 } catch (error) {
 console.error("Upload error:", error);
 toast.error("Upload failed. Please try again.", { id: toastId });
 } finally {
 loader(false);
 }
 };

 const handleSaveProfile = async () => {
 setSaving(true);
 setPersonalError(null);
 
 try {
 // 1. Save Personal Info
 const profileResult = await updateProfile({ 
 name: name.trim() || null, 
 image: userImage ?? null,
 email: email.trim() || null
 });
 if (!profileResult.success) {
 setPersonalError(profileResult.error);
 setSaving(false);
 return;
 }

 // 2. Save Organization Name
 const orgId = session?.user?.organizationId;
 const currentOrgName = session?.user?.organizationName ?? "";
 if (orgId && organizationName.trim() !== currentOrgName) {
 const orgResult = await updateOrganizationName(organizationName.trim());
 if (!orgResult.success) {
 setPersonalError(orgResult.error);
 setSaving(false);
 return;
 }
 }

 // 3. Save Business Info
 const metaResult = await updateMetaProfile({
 businessAddress,
 businessDescription,
 businessEmail,
 businessLogo,
 businessVertical,
 businessWebsites: websites,
 });
 if (!metaResult.success) {
 alert(metaResult.error);
 setSaving(false);
 return;
 }

 await updateSession();
 
 } catch (error) {
 console.error("Failed to save profile", error);
 alert("Failed to save profile");
 } finally {
 setSaving(false);
 }
 };

 if (loading || !session?.user) {
 return (
 <DashboardLayoutClient mainClassName="pb-12">
 <div className="flex items-center justify-center min-h-[40vh]">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
 </div>
 </DashboardLayoutClient>
 );
 }
 
 // Derived state for User Profile
 const displayUserImage = userImage ?? session.user.image ?? null;
 const displayUserName = name || (session.user.name ?? "");

 return (
 <DashboardLayoutClient mainClassName="p-0 bg-white dark:bg-slate-950 antialiased h-[calc(100vh-64px)] overflow-hidden">
 <div className="h-full overflow-y-auto p-8">
 <div className="max-w-[1200px] mx-auto flex flex-col gap-10">
 {/* Page Header */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
 <div className="space-y-1">
 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
 <span className="text-[10px] font-bold text-emerald-600 tracking-widest">Profile Module</span>
 </div>
 <h2 className="text-3xl font-bold tracking-tight text-foreground">
 Personal Information
 </h2>
 <p className="text-muted-foreground text-sm font-medium">
 Manage your personal and business details here.
 </p>
 </div>
 </div>

 {/* Content Section */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
 {/* Main Form Section */}
 <div className="lg:col-span-2 space-y-8">
 {personalError && (
 <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300 mb-6">
 {personalError}
 </div>
 )}
 <Card className="border-border/50 bg-card shadow-sm rounded-[32px] overflow-hidden">
 <CardContent className="p-10 space-y-10">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
 <Building2 className="w-6 h-6 text-emerald-600" />
 </div>
 <div>
 <h3 className="text-lg font-bold tracking-tight">Profile info</h3>
 <p className="text-xs text-muted-foreground font-medium">Core information for your profile.</p>
 </div>
 </div>

 <div className="space-y-8">
 {/* Personal Fields (Name, Email, Photo) */}
 <div className="space-y-4">
 <label className="text-[10px] font-bold tracking-widest text-muted-foreground px-1">Photo</label>
 <div className="flex items-center gap-8 p-6 bg-muted/10 rounded-3xl border border-dashed border-border/50 relative overflow-hidden">
 <input 
 type="file" 
 ref={userImageRef} 
 className="hidden" 
 accept="image/*"
 onChange={(e) => handleUpload(e,'user')}
 />
 <div className="w-24 h-24 rounded-full bg-card border-4 border-emerald-500/10 flex items-center justify-center shrink-0 shadow-inner overflow-hidden relative" style={{ backgroundColor: displayUserImage ? "transparent" : ACCENT }}>
 {displayUserImage ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={displayUserImage} alt="" className="object-cover w-full h-full" />
 ) : (
 <span className="text-white font-semibold text-2xl">{initials(displayUserName)}</span>
 )}
 {isUploadingUserImage && (
 <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
 <Loader2 className="w-6 h-6 animate-spin text-white" />
 </div>
 )}
 </div>
 <div className="space-y-3 flex-1">
 <div className="flex gap-2">
 <Button 
 size="sm" 
 className="h-10 px-6 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-bold text-[10px] tracking-widest gap-2"
 onClick={() => userImageRef.current?.click()}
 disabled={isUploadingUserImage}
 >
 <Upload className="w-3.5 h-3.5" />
 {isUploadingUserImage ? "Uploading..." : "Change photo"}
 </Button>
 <Button 
 variant="outline" 
 size="sm" 
 className="h-10 px-6 rounded-xl border-border/50 text-muted-foreground font-bold text-[10px] tracking-widest"
 onClick={() => setUserImage(null)}
 >
 Remove
 </Button>
 </div>
 <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
 Upload a profile photo directly to the cloud.
 </p>
 </div>
 </div>
 </div>

 {/* Personal Fields (Name, Email, Photo) */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div className="space-y-2.5">
 <label className="text-[10px] font-bold tracking-widest text-muted-foreground px-1">Full name</label>
 <Input
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="h-12 bg-muted/10 border-border/50 rounded-2xl px-5 text-sm font-medium focus-visible:ring-emerald-500/20"
 placeholder="Your name"
 />
 </div>
 <div className="space-y-2.5">
 <label className="text-[10px] font-bold tracking-widest text-muted-foreground px-1">Email</label>
 <Input
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 type="email"
 className="h-12 bg-muted/10 border-border/50 rounded-2xl px-5 text-sm font-medium focus-visible:ring-emerald-500/20"
 placeholder="your@email.com"
 />
 </div>
 </div>

 {/* Organization Field */}
 <div className="space-y-2.5">
 <label className="text-[10px] font-bold tracking-widest text-muted-foreground px-1">Organization name</label>
 {session.user.organizationId ? (
 <Input
 value={organizationName}
 onChange={(e) => setOrganizationName(e.target.value)}
 placeholder="Your organization name"
 className="h-12 bg-muted/10 border-border/50 rounded-2xl px-5 text-sm font-medium focus-visible:ring-emerald-500/20"
 />
 ) : (
 <Input value="—" readOnly className="h-12 bg-muted/10 border-border/50 rounded-2xl px-5 text-sm font-medium opacity-90" />
 )}
 <p className="text-[10px] text-muted-foreground font-medium px-1">Workspace you belong to.</p>
 </div>
 
 <div className="h-px w-full bg-border/50 my-2" />

 {/* Original Business Fields */}
 

 <div className="space-y-2.5">
 <div className="flex justify-between items-center px-1">
 <label className="text-[10px] font-bold tracking-widest text-muted-foreground">Description</label>
 <span className="text-[10px] font-bold text-muted-foreground/60 tracking-wider">{businessDescription.length} / 512</span>
 </div>
 <Textarea 
 placeholder="Brief overview of your business services..." 
 className="min-h-[140px] bg-muted/10 border-border/50 rounded-[24px] px-5 py-4 text-sm font-medium resize-none leading-relaxed" 
 value={businessDescription}
 onChange={(e) => setBusinessDescription(e.target.value.slice(0, 512))}
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div className="space-y-2.5">
 <label className="text-[10px] font-bold tracking-widest text-muted-foreground px-1">Address</label>
 <Input 
 placeholder="Global HQ, Street address..." 
 className="h-12 bg-muted/10 border-border/50 rounded-2xl px-5 text-sm font-medium focus-visible:ring-emerald-500/20" 
 value={businessAddress}
 onChange={(e) => setBusinessAddress(e.target.value)}
 />
 </div>
 <div className="space-y-2.5">
 <label className="text-[10px] font-bold tracking-widest text-muted-foreground px-1">Categories</label>
 <Select value={businessVertical} onValueChange={setBusinessVertical}>
 <SelectTrigger className="h-12 bg-muted/10 border-border/50 rounded-2xl px-5 text-sm font-medium focus:ring-emerald-500/20">
 <SelectValue placeholder="Industry Sector" />
 </SelectTrigger>
 <SelectContent className="rounded-2xl border-border/50 shadow-2xl">
 <SelectItem value="Retail" className="rounded-xl">Retail & E-commerce</SelectItem>
 <SelectItem value="Services" className="rounded-xl">Professional Services</SelectItem>
 <SelectItem value="Technology" className="rounded-xl">SaaS & Technology</SelectItem>
 <SelectItem value="Healthcare" className="rounded-xl">Healthcare</SelectItem>
 <SelectItem value="Finance" className="rounded-xl">Finance</SelectItem>
 <SelectItem value="Education" className="rounded-xl">Education</SelectItem>
 <SelectItem value="Other" className="rounded-xl">Other</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="space-y-4">
 <label className="text-[10px] font-bold tracking-widest text-muted-foreground px-1">Digital Presence</label>
 <div className="space-y-3">
 {websites.map((site, index) => (
 <div key={index} className="flex gap-2">
 <div className="flex-1 px-5 py-3 bg-muted/10 border border-border/50 rounded-2xl text-sm font-medium">
 {site}
 </div>
 <Button 
 variant="ghost" 
 className="h-auto px-3 py-3 rounded-2xl text-red-500 hover:bg-red-500/10"
 onClick={() => handleRemoveWebsite(index)}
 >
 <Trash2 className="w-4 h-4" />
 </Button>
 </div>
 ))}
 <div className="flex gap-2">
 <Input 
 placeholder="https://primary-website.com" 
 className="h-12 bg-muted/10 border-border/50 rounded-2xl px-5 text-sm font-medium" 
 value={businessWebsite}
 onChange={(e) => setBusinessWebsite(e.target.value)}
 />
 <Button 
 variant="ghost" 
 className="h-12 rounded-2xl border border-dashed border-border/50 hover:bg-emerald-500/3 text-emerald-600 font-bold text-[10px] tracking-widest gap-2 px-6"
 onClick={handleAddWebsite}
 >
 <Plus className="w-3.5 h-3.5" />
 Append
 </Button>
 </div>
 </div>
 </div>

 <div className="h-px w-full bg-border/50 my-2" />

 {/* Business Logo Section */}
 <div className="space-y-4">
 <label className="text-[10px] font-bold tracking-widest text-muted-foreground px-1">Business Logo</label>
 <input 
 type="file" 
 ref={businessLogoRef} 
 className="hidden" 
 accept="image/*"
 onChange={(e) => handleUpload(e,'business')}
 />
 <div className="flex items-center gap-8 p-6 bg-muted/10 rounded-3xl border border-dashed border-border/50 relative overflow-hidden">
 <div className="w-24 h-24 rounded-2xl bg-card border-4 border-emerald-500/10 flex items-center justify-center shrink-0 shadow-inner overflow-hidden relative">
 {businessLogo ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={businessLogo} alt="" className="object-cover w-full h-full" />
 ) : (
 <ImageIcon className="w-8 h-8 text-emerald-500/40" strokeWidth={1.5} />
 )}
 {isUploadingLogo && (
 <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
 <Loader2 className="w-6 h-6 animate-spin text-white" />
 </div>
 )}
 </div>
 <div className="space-y-3 flex-1">
 <div className="flex gap-2">
 <Button 
 size="sm" 
 className="h-10 px-6 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-bold text-[10px] tracking-widest gap-2"
 onClick={() => businessLogoRef.current?.click()}
 disabled={isUploadingLogo}
 >
 <Upload className="w-3.5 h-3.5" />
 {isUploadingLogo ? "Uploading..." : "Change logo"}
 </Button>
 <Button 
 variant="outline" 
 size="sm" 
 className="h-10 px-6 rounded-xl border-border/50 text-muted-foreground font-bold text-[10px] tracking-widest"
 onClick={() => setBusinessLogo(null)}
 >
 Remove
 </Button>
 </div>
 <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
 Upload your official business logo for the profile.
 </p>
 </div>
 </div>
 </div>
 </div>

 <div className="pt-6">
 <Button 
 className="w-full h-14 bg-primary hover:opacity-90 text-primary-foreground shadow-2xl shadow-emerald-500/20 rounded-2xl font-bold tracking-widest text-[10px] gap-2"
 onClick={handleSaveProfile}
 disabled={saving}
 >
 {saving ? "Saving Changes..." : "Save Changes"}
 </Button>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Right Panel - Profile Preview */}
 <div className="lg:col-span-1">
 <div className="sticky top-24 space-y-6">
 <Card className="border-emerald-500/20 bg-emerald-950/5 dark:bg-emerald-500/3 shadow-2xl rounded-[40px] overflow-hidden border-2 transition-all duration-300 relative">
 <div className="bg-emerald-600 h-24 relative overflow-hidden">
 <div className="absolute top-0 right-0 p-4">
 <div className="w-1.5 h-1.5 rounded-full bg-white opacity-50 shadow-sm" />
 </div>
 </div>
 <div className="absolute top-10 left-10 w-24 h-24 rounded-full bg-card border-[6px] border-emerald-950/10 dark:border-white/10 flex items-center justify-center overflow-hidden shadow-2xl ring-4 ring-emerald-600 z-10" style={{ backgroundColor: displayUserImage ? "transparent" : ACCENT }}>
 {displayUserImage ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={displayUserImage} alt="" className="object-cover w-full h-full" />
 ) : (
 <span className="text-white font-semibold text-2xl">{initials(displayUserName)}</span>
 )}
 </div>
 <CardContent className="pt-16 p-10 space-y-8">
 <div className="space-y-1">
 <div className="flex items-center gap-2">
 <h3 className="text-2xl font-bold tracking-tight">{displayUserName || "Your Name"}</h3>
 <CheckCircle2 className="w-5 h-5 text-emerald-600" />
 </div>
 <p className="text-xs font-bold text-emerald-600/70 tracking-tight">{email || "email@example.com"}</p>
 </div>

 <div className="space-y-6">
 <div className="flex gap-4 items-start">
 <div className="w-9 h-9 rounded-xl bg-card border border-border/50 flex items-center justify-center shrink-0">
 <Building2 className="w-4 h-4 text-muted-foreground" />
 </div>
 <div className="space-y-0.5">
 <p className="text-[10px] font-bold tracking-widest text-muted-foreground/50">Organization</p>
 <p className="text-sm font-bold opacity-80 italic">{organizationName || "Not set"}</p>
 </div>
 </div>
 
 <div className="flex gap-4 items-start">
 <div className="w-9 h-9 rounded-xl bg-card border border-border/50 flex items-center justify-center shrink-0">
 <User className="w-4 h-4 text-muted-foreground" />
 </div>
 <div className="space-y-0.5">
 <p className="text-[10px] font-bold tracking-widest text-muted-foreground/50">Role</p>
 <p className="text-sm font-bold opacity-80 italic">{businessVertical || "Not set"}</p>
 </div>
 </div>

 <div className="flex gap-4 items-start">
 <div className="w-9 h-9 rounded-xl bg-card border border-border/50 flex items-center justify-center shrink-0">
 <File className="w-4 h-4 text-muted-foreground" />
 </div>
 <div className="space-y-0.5">
 <p className="text-[10px] font-bold tracking-widest text-muted-foreground/50">About</p>
 <p className="text-xs font-medium text-muted-foreground leading-relaxed">
 {businessDescription || "No description provided."}
 </p>
 </div>
 </div>
 </div>

 <div className="pt-6 border-t border-emerald-500/10 flex justify-between items-center">
 <p className="text-[9px] font-bold tracking-widest text-emerald-600">WhatsApp verified</p>
 <div className="flex -space-x-2">
 {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full border-2 border-card bg-muted/20" />)}
 </div>
 </div>
 </CardContent>
 </Card>

 <div className="p-6 bg-muted/10 rounded-[32px] border border-border/50 flex items-center gap-4">
 <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
 <Info className="w-5 h-5 text-blue-600" />
 </div>
 <p className="text-[10px] font-bold text-muted-foreground leading-relaxed">
 Profile completion status. <span className="text-foreground font-bold">Update fields</span> to improve visibility.
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </DashboardLayoutClient>
 );
}
