"use client"
import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { getUserProfile, updateUserProfile, updateUserAvatar } from "@/app/actions/user"
import { 
  Loader2, 
  Eye, 
  EyeOff, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  ShieldCheck, 
  Camera,
  Check,
  FileText,
  ExternalLink,
  Shield,
  Upload
} from "lucide-react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export default function ProfileSettings() {
  const { update: updateSession } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [initialData, setInitialData] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    image: ""
  });

  const [formData, setFormData] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    password: "",
    newPassword: "",
    confirmPassword: "",
    image: ""
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await getUserProfile();
        const data = {
          username: (profile.name || "").replace(/\s+/g, '').toLowerCase(),
          firstName: profile.firstName || "",
          lastName: profile.lastName || "",
          email: profile.email || "",
          phoneNumber: profile.phoneNumber || "",
          image: profile.image || ""
        };
        setInitialData(data);
        setFormData(prev => ({
          ...prev,
          ...data
        }));
      } catch (error) {
        console.error("Failed to load profile", error);
        toast.error("Failed to load profile data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const hasChanges = 
    formData.firstName !== initialData.firstName ||
    formData.lastName !== initialData.lastName ||
    formData.email !== initialData.email ||
    formData.phoneNumber !== initialData.phoneNumber ||
    formData.image !== initialData.image ||
    formData.password !== "" ||
    formData.newPassword !== "" ||
    formData.confirmPassword !== "";

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }

    setIsUploadingImage(true);
    const uploadToast = toast.loading("Uploading image...");

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const data = await response.json();
      if (data.url) {
        const result = await updateUserAvatar(data.url);
        if (result.success) {
          setFormData(prev => ({ ...prev, image: data.url }));
          setInitialData(prev => ({ ...prev, image: data.url }));
          await updateSession();
          toast.success("Profile picture updated", { id: uploadToast });
        } else {
          toast.error(result.error || "Failed to save profile picture", { id: uploadToast });
        }
      } else {
        toast.error(data.error || "Failed to upload image", { id: uploadToast });
      }
    } catch (error) {
      console.error("Image upload failed", error);
      toast.error("An unexpected error occurred during upload", { id: uploadToast });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      username: initialData.username,
      firstName: initialData.firstName,
      lastName: initialData.lastName,
      email: initialData.email,
      phoneNumber: initialData.phoneNumber,
      image: initialData.image,
      password: "",
      newPassword: "",
      confirmPassword: ""
    });
    toast.info("Changes discarded");
  };

  const handleSubmit = async () => {
    setIsSaving(true);

    if (formData.newPassword || formData.password || formData.confirmPassword) {
      if (!formData.password) {
        toast.error("Current password is required to set a new password");
        setIsSaving(false);
        return;
      }
      if (!formData.newPassword) {
        toast.error("New password cannot be empty");
        setIsSaving(false);
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        toast.error("New passwords do not match");
        setIsSaving(false);
        return;
      }
      if (formData.newPassword.length < 8) {
        toast.error("New password must be at least 8 characters long");
        setIsSaving(false);
        return;
      }
    }

    try {
      const result = await updateUserProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        currentPassword: formData.password || undefined,
        password: formData.newPassword || undefined
      });

      if (result.success) {
        toast.success("Profile updated successfully");
        setInitialData({
          ...initialData,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phoneNumber: formData.phoneNumber
        });
        setFormData(prev => ({ ...prev, password: "", newPassword: "", confirmPassword: "" }));
      } else {
        toast.error(result.error || "Failed to update profile");
      }
    } catch (error) {
      console.error(error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4 min-h-[60vh] plus-jakarta-forced">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        <p className="text-xs font-bold text-slate-500 tracking-widest uppercase animate-pulse">Loading Profile</p>
      </div>
    );
  }

  const initials = `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase() || "A";

  return (
    <div className="plus-jakarta-forced max-w-[1200px] mx-auto p-6 md:p-10 pb-32">
      
      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
          <User className="w-4 h-4" />
          <p className="text-[10px] font-black uppercase tracking-widest">Account</p>
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Admin Profile</h1>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1.5 max-w-xl leading-relaxed">
          Manage your personal details, login information, and account security.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column - Summary & Helpful Links */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8">
          
          {/* Profile Summary Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-[32px] p-8 shadow-sm flex flex-col items-center text-center">
            
            <div className="relative group mb-5">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <div className="w-28 h-28 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden relative transition-transform duration-300 group-hover:scale-105">
                {isUploadingImage && (
                  <div className="absolute inset-0 z-20 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  </div>
                )}
                {formData.image ? (
                  <img src={formData.image} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                    <span className="text-4xl font-black text-slate-500 dark:text-slate-400">{initials}</span>
                  </div>
                )}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                >
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Change</span>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {formData.firstName} {formData.lastName}
            </h2>
            <p className="text-xs font-bold text-slate-500 tracking-wider mt-1">@{formData.username || 'admin'}</p>
            
            <span className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-500/20 text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" />
              Administrator
            </span>

            <div className="w-full h-px bg-slate-100 dark:bg-slate-800/80 my-6"></div>

            <div className="w-full space-y-4 text-left">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-0.5">Email</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{formData.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-0.5">Phone</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{formData.phoneNumber || 'Not set'}</p>
                </div>
              </div>
            </div>

          </div>

          {/* Helpful Links */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-[32px] p-6 shadow-sm">
            <h3 className="text-[11px] font-black tracking-widest text-slate-400 uppercase mb-4 pl-1">Helpful Links</h3>
            <div className="space-y-1.5">
              {[
                { title: "User Terms", link: "/terms-and-policies/user_terms", icon: FileText },
                { title: "Terms of Service", link: "/terms-and-policies/terms_of_service", icon: FileText },
                { title: "Privacy Policy", link: "/terms-and-policies/privacy_policy", icon: Shield }
              ].map((item, idx) => (
                <a 
                  key={idx}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
                >
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    <item.icon className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                    <span className="text-sm font-semibold">{item.title}</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                </a>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column - Forms */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Personal Information */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-[32px] p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-slate-800 mb-8">
              <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Personal Information</h3>
                <p className="text-xs font-medium text-slate-500">Update your name and contact details.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
              <div className="space-y-2">
                <Label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">First Name</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="John"
                    className="pl-11 h-12 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/60 dark:border-slate-800 rounded-2xl text-sm font-semibold focus-visible:ring-1 focus-visible:ring-slate-300"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Last Name</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Doe"
                    className="pl-11 h-12 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/60 dark:border-slate-800 rounded-2xl text-sm font-semibold focus-visible:ring-1 focus-visible:ring-slate-300"
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    className="pl-11 h-12 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/60 dark:border-slate-800 rounded-2xl text-sm font-semibold focus-visible:ring-1 focus-visible:ring-slate-300"
                  />
                </div>
                <p className="text-[11px] text-slate-400 font-medium ml-1">Used for login and administrative notifications.</p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    placeholder="+1234567890"
                    className="pl-11 h-12 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/60 dark:border-slate-800 rounded-2xl text-sm font-semibold focus-visible:ring-1 focus-visible:ring-slate-300"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Security & Password */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-[32px] p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-slate-800 mb-8">
              <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Security Settings</h3>
                <p className="text-xs font-medium text-slate-500">Update your password to keep your account secure.</p>
              </div>
            </div>

            <div className="space-y-7">
              <div className="space-y-2">
                <Label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Current Password</Label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    name="password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter current password"
                    className="pl-11 pr-12 h-12 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/60 dark:border-slate-800 rounded-2xl text-sm font-semibold focus-visible:ring-1 focus-visible:ring-slate-300"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 font-medium ml-1">Required only if you are setting a new password.</p>
              </div>

              <div className="w-full h-px bg-slate-100 dark:bg-slate-800/50"></div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      name="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={formData.newPassword}
                      onChange={handleChange}
                      placeholder="Minimum 8 characters"
                      className="pl-11 pr-12 h-12 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/60 dark:border-slate-800 rounded-2xl text-sm font-semibold focus-visible:ring-1 focus-visible:ring-slate-300"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Repeat new password"
                      className="pl-11 pr-12 h-12 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/60 dark:border-slate-800 rounded-2xl text-sm font-semibold focus-visible:ring-1 focus-visible:ring-slate-300"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Sticky Save Footer */}
      <div className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300",
        hasChanges ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-8 pointer-events-none"
      )}>
        <div className="bg-slate-900 dark:bg-slate-800 p-2 rounded-3xl shadow-2xl flex items-center gap-2 border border-slate-800 dark:border-slate-700">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="h-11 px-5 rounded-2xl text-[13px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-all"
          >
            Discard
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !hasChanges}
            className="h-11 px-6 bg-white text-slate-900 rounded-2xl text-[13px] font-black hover:bg-slate-100 transition-all flex items-center gap-2 shadow-sm"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>

    </div>
  )
}
