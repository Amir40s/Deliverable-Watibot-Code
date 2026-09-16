"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import {
  Store,
  Package,
  Truck,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle2,
  HelpCircle,
  Clock,
  DollarSign,
  Layers,
  Sparkles,
  ShoppingBag,
  Info,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  getBusinessProfileData,
  updateBusinessProfileData,
  getBusinessProducts,
  saveBusinessProduct,
  deleteBusinessProduct,
  getBusinessServicesList,
  saveBusinessService,
  deleteBusinessService,
} from "@/app/actions/business-profile";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const PAYMENT_OPTIONS = [
  "Cash on Delivery",
  "Bank Transfer",
  "EasyPaisa",
  "JazzCash",
  "Credit / Debit Card",
];

export default function BusinessKnowledgeClient() {
  const [activeTab, setActiveTab] = useState<"general" | "products" | "delivery" | "services">("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Business Profile State
  const [profile, setProfile] = useState<any>({
    storeName: "",
    businessType: "hybrid",
    description: "",
    currency: "PKR",
    deliveryCharges: 0,
    deliveryAreas: "",
    deliveryTime: "2-4 working days",
    paymentMethods: ["Cash on Delivery", "Bank Transfer"],
    returnPolicy: "",
    customInstructions: "",
    faqs: [],
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    openingTime: "09:00",
    closingTime: "18:00",
    slotDuration: 30,
    bookingRules: "",
    appointmentPolicies: "",
    staffMembers: [],
  });

  // Products State
  const [products, setProducts] = useState<any[]>([]);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState<any>({
    name: "",
    description: "",
    price: 0,
    currency: "PKR",
    category: "General",
    sku: "",
    stock: 100,
    imageUrl: "",
    isAvailable: true,
    variants: [],
  });

  // Variant input sub-state
  const [variantInput, setVariantInput] = useState({
    name: "",
    size: "",
    color: "",
    price: "",
    stock: "",
  });

  // Services State
  const [services, setServices] = useState<any[]>([]);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [serviceForm, setServiceForm] = useState<any>({
    name: "",
    description: "",
    price: 0,
    currency: "PKR",
    durationMinutes: 30,
    staff: "",
    category: "General",
    isActive: true,
  });

  // FAQ input state
  const [newFaq, setNewFaq] = useState({ question: "", answer: "" });

  // Load initial data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [pRes, prodRes, servRes] = await Promise.all([
        getBusinessProfileData(),
        getBusinessProducts(),
        getBusinessServicesList(),
      ]);

      if (pRes.success && pRes.profile) {
        setProfile({
          ...pRes.profile,
          paymentMethods: pRes.profile.paymentMethods || ["Cash on Delivery"],
          workingDays: pRes.profile.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          faqs: pRes.profile.faqs || [],
        });
      }

      if (prodRes.success && prodRes.products) {
        setProducts(prodRes.products);
      }

      if (servRes.success && servRes.services) {
        setServices(servRes.services);
      }
    } catch (err: any) {
      toast.error("Failed to load business profile: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await updateBusinessProfileData({
        ...profile,
        deliveryCharges: Number(profile.deliveryCharges) || 0,
        slotDuration: Number(profile.slotDuration) || 30,
      });
      if (res.success) {
        toast.success("Business Knowledge updated successfully! AI is now using this information.");
      } else {
        toast.error(res.error || "Failed to save profile.");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Product Handlers ──
  const openNewProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: "",
      description: "",
      price: 0,
      currency: profile.currency || "PKR",
      category: "General",
      sku: "",
      stock: 100,
      imageUrl: "",
      isAvailable: true,
      variants: [],
    });
    setVariantInput({ name: "", size: "", color: "", price: "", stock: "" });
    setProductModalOpen(true);
  };

  const openEditProductModal = (p: any) => {
    setEditingProduct(p);
    setProductForm({
      id: p.id,
      name: p.name,
      description: p.description || "",
      price: p.price,
      currency: p.currency || profile.currency || "PKR",
      category: p.category || "General",
      sku: p.sku || "",
      stock: p.stock ?? 100,
      imageUrl: p.imageUrl || "",
      isAvailable: p.isAvailable !== false,
      variants: Array.isArray(p.variants) ? p.variants : [],
    });
    setVariantInput({ name: "", size: "", color: "", price: "", stock: "" });
    setProductModalOpen(true);
  };

  const handleAddVariant = () => {
    if (!variantInput.name.trim() && !variantInput.size.trim() && !variantInput.color.trim()) {
      toast.error("Please enter a variant name, size, or color.");
      return;
    }
    const newVariant = {
      id: "var_" + Date.now(),
      name: variantInput.name.trim() || `${variantInput.size} ${variantInput.color}`.trim(),
      size: variantInput.size.trim() || undefined,
      color: variantInput.color.trim() || undefined,
      price: variantInput.price ? Number(variantInput.price) : Number(productForm.price),
      stock: variantInput.stock ? Number(variantInput.stock) : Number(productForm.stock),
    };

    setProductForm({
      ...productForm,
      variants: [...(productForm.variants || []), newVariant],
    });
    setVariantInput({ name: "", size: "", color: "", price: "", stock: "" });
  };

  const handleRemoveVariant = (index: number) => {
    setProductForm({
      ...productForm,
      variants: productForm.variants.filter((_: any, idx: number) => idx !== index),
    });
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) {
      toast.error("Product name is required.");
      return;
    }

    try {
      const res = await saveBusinessProduct({
        ...productForm,
        price: Number(productForm.price) || 0,
        stock: Number(productForm.stock) || 0,
      });
      if (res.success) {
        toast.success(editingProduct ? "Product updated!" : "Product added!");
        setProductModalOpen(false);
        const prodRes = await getBusinessProducts();
        if (prodRes.success && prodRes.products) setProducts((prodRes.products as any[]) || []);
      } else {
        toast.error(res.error || "Failed to save product.");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await deleteBusinessProduct(id);
      if (res.success) {
        toast.success("Product deleted.");
        setProducts(products.filter((p) => p.id !== id));
      } else {
        toast.error(res.error || "Failed to delete.");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── Service Handlers ──
  const openNewServiceModal = () => {
    setEditingService(null);
    setServiceForm({
      name: "",
      description: "",
      price: 0,
      currency: profile.currency || "PKR",
      durationMinutes: 30,
      staff: "",
      category: "General",
      isActive: true,
    });
    setServiceModalOpen(true);
  };

  const openEditServiceModal = (s: any) => {
    setEditingService(s);
    setServiceForm({
      id: s.id,
      name: s.name,
      description: s.description || "",
      price: s.price,
      currency: s.currency || profile.currency || "PKR",
      durationMinutes: s.durationMinutes || 30,
      staff: s.staff || "",
      category: s.category || "General",
      isActive: s.isActive !== false,
    });
    setServiceModalOpen(true);
  };

  const handleSaveService = async () => {
    if (!serviceForm.name.trim()) {
      toast.error("Service name is required.");
      return;
    }

    try {
      const res = await saveBusinessService({
        ...serviceForm,
        price: Number(serviceForm.price) || 0,
        durationMinutes: Number(serviceForm.durationMinutes) || 30,
      });
      if (res.success) {
        toast.success(editingService ? "Service updated!" : "Service added!");
        setServiceModalOpen(false);
        const servRes = await getBusinessServicesList();
        if (servRes.success && servRes.services) setServices((servRes.services as any[]) || []);
      } else {
        toast.error(res.error || "Failed to save service.");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    try {
      const res = await deleteBusinessService(id);
      if (res.success) {
        toast.success("Service deleted.");
        setServices(services.filter((s) => s.id !== id));
      } else {
        toast.error(res.error || "Failed to delete.");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── FAQ Handlers ──
  const handleAddFaq = () => {
    if (!newFaq.question.trim() || !newFaq.answer.trim()) {
      toast.error("Please provide both a question and an answer.");
      return;
    }
    setProfile({
      ...profile,
      faqs: [...(profile.faqs || []), { ...newFaq }],
    });
    setNewFaq({ question: "", answer: "" });
  };

  const handleRemoveFaq = (index: number) => {
    setProfile({
      ...profile,
      faqs: profile.faqs.filter((_: any, i: number) => i !== index),
    });
  };

  const toggleWorkingDay = (day: string) => {
    const current = profile.workingDays || [];
    if (current.includes(day)) {
      setProfile({ ...profile, workingDays: current.filter((d: string) => d !== day) });
    } else {
      setProfile({ ...profile, workingDays: [...current, day] });
    }
  };

  const togglePaymentMethod = (method: string) => {
    const current = profile.paymentMethods || [];
    if (current.includes(method)) {
      setProfile({ ...profile, paymentMethods: current.filter((m: string) => m !== method) });
    } else {
      setProfile({ ...profile, paymentMethods: [...current, method] });
    }
  };

  if (loading) {
    return (
      <DashboardLayoutClient mainClassName="pb-16 antialiased">
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">Loading business profile and knowledge...</p>
          </div>
        </div>
      </DashboardLayoutClient>
    );
  }

  return (
    <DashboardLayoutClient mainClassName="pb-16 antialiased">
      <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">AI Business Knowledge</h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Sparkles className="h-3 w-3" /> Live Knowledge Base
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your complete business facts. The AI uses this single source of truth to answer customer questions and take orders or appointments.
          </p>
        </div>

        <Button onClick={handleSaveProfile} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm">
          <Save className="h-4 w-4" />
          {saving ? "Saving Changes..." : "Save Knowledge Profile"}
        </Button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "general"
              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Store className="h-4 w-4" /> Store & General Info
        </button>
        <button
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "products"
              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Package className="h-4 w-4" /> Products & Variants ({products.length})
        </button>
        <button
          onClick={() => setActiveTab("delivery")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "delivery"
              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Truck className="h-4 w-4" /> Delivery & Policies
        </button>
        <button
          onClick={() => setActiveTab("services")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "services"
              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Calendar className="h-4 w-4" /> Services & Appointments ({services.length})
        </button>
      </div>

      {/* TAB 1: STORE & GENERAL INFO */}
      {activeTab === "general" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Business Identity</CardTitle>
              <CardDescription>Primary profile and operating type used by the AI agent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business / Store Name</Label>
                  <Input
                    value={profile.storeName || ""}
                    onChange={(e) => setProfile({ ...profile, storeName: e.target.value })}
                    placeholder="e.g. Trendy Apparel or Glamour Salon"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business Model</Label>
                  <Select
                    value={profile.businessType || "hybrid"}
                    onValueChange={(val) => setProfile({ ...profile, businessType: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="store">E-Commerce / Online Store (Orders Only)</SelectItem>
                      <SelectItem value="appointment">Appointment / Service Business</SelectItem>
                      <SelectItem value="hybrid">Hybrid (Both Orders & Appointments)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Currency</Label>
                  <Select
                    value={profile.currency || "PKR"}
                    onValueChange={(val) => setProfile({ ...profile, currency: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PKR">PKR (Pakistani Rupee)</SelectItem>
                      <SelectItem value="USD">USD (US Dollar)</SelectItem>
                      <SelectItem value="EUR">EUR (Euro)</SelectItem>
                      <SelectItem value="GBP">GBP (British Pound)</SelectItem>
                      <SelectItem value="AED">AED (UAE Dirham)</SelectItem>
                      <SelectItem value="SAR">SAR (Saudi Riyal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Business Description</Label>
                <Textarea
                  rows={3}
                  value={profile.description || ""}
                  onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                  placeholder="Tell the AI what your business does, brand history, mission, or target audience..."
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  Custom AI Instructions & Tone Guidelines
                </Label>
                <Textarea
                  rows={4}
                  value={profile.customInstructions || ""}
                  onChange={(e) => setProfile({ ...profile, customInstructions: e.target.value })}
                  placeholder="e.g., Be friendly and hospitable. Always offer size medium first for unisex items. Mention that home trials are available in Lahore..."
                />
                <p className="text-xs text-muted-foreground">
                  The AI will adhere strictly to these guidelines during conversations.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How AI Uses This</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Strict Isolation</h4>
                  <p className="text-xs">Your AI agent exclusively references this profile. Data is never shared across tenants.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Zero Hallucination</h4>
                  <p className="text-xs">Prices, stock, delivery charges, and slots are checked directly in the backend before answering.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Multi-Language</h4>
                  <p className="text-xs">AI automatically speaks English, Roman Urdu, or Urdu based on what the customer writes.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: PRODUCTS & CATALOG */}
      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
            <div>
              <h3 className="text-lg font-semibold">Product Catalog & Inventory</h3>
              <p className="text-sm text-muted-foreground">
                Products the AI can recommend, check availability for, and place orders with.
              </p>
            </div>
            <Button onClick={openNewProductModal} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          </div>

          {products.length === 0 ? (
            <Card className="border-dashed p-12 text-center">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="rounded-full bg-emerald-50 dark:bg-emerald-950 p-4">
                  <Package className="h-8 w-8 text-emerald-600" />
                </div>
                <h4 className="text-base font-semibold">No products added yet</h4>
                <p className="text-sm text-muted-foreground max-w-md">
                  Add your store's products with sizes, colors, and stock so the AI can answer inquiries and take customer orders.
                </p>
                <Button onClick={openNewProductModal} className="mt-2 bg-emerald-600 text-white hover:bg-emerald-700">
                  Add First Product
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p) => (
                <Card key={p.id} className="relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <Badge variant="secondary" className="text-xs mb-1">
                          {p.category || "General"}
                        </Badge>
                        <CardTitle className="text-base">{p.name}</CardTitle>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                          {p.currency} {p.price}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {p.stock > 0 ? (
                            <span className="text-emerald-600 font-medium">In Stock ({p.stock})</span>
                          ) : (
                            <span className="text-rose-500 font-medium">Out of Stock</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-4">
                    {p.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                    )}

                    {Array.isArray(p.variants) && p.variants.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-muted-foreground">Variants / Sizes / Colors:</span>
                        <div className="flex flex-wrap gap-1">
                          {p.variants.map((v: any, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs py-0.5 px-1.5">
                              {v.name || `${v.size || ""} ${v.color || ""}`.trim()}
                              {v.price ? ` (${p.currency} ${v.price})` : ""}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {p.sku ? `SKU: ${p.sku}` : "No SKU"}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditProductModal(p)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProduct(p.id)}
                          className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DELIVERY & STORE POLICIES */}
      {activeTab === "delivery" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Delivery & Fulfillment Rules</CardTitle>
              <CardDescription>Configure rates and areas so the AI accurately quotes shipping.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Delivery Charges ({profile.currency || "PKR"})</Label>
                <Input
                  type="number"
                  value={profile.deliveryCharges ?? 0}
                  onChange={(e) => setProfile({ ...profile, deliveryCharges: Number(e.target.value) })}
                  placeholder="e.g. 200 (Enter 0 for Free Delivery)"
                />
                <p className="text-xs text-muted-foreground">
                  The AI will automatically add this to the order subtotal during calculation.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Estimated Delivery Turnaround</Label>
                <Input
                  value={profile.deliveryTime || ""}
                  onChange={(e) => setProfile({ ...profile, deliveryTime: e.target.value })}
                  placeholder="e.g. 2-4 working days, Same day in Karachi"
                />
              </div>

              <div className="space-y-2">
                <Label>Delivery Service Areas</Label>
                <Textarea
                  rows={2}
                  value={profile.deliveryAreas || ""}
                  onChange={(e) => setProfile({ ...profile, deliveryAreas: e.target.value })}
                  placeholder="e.g. Nationwide Pakistan, or list specific cities like Karachi, Lahore, Islamabad..."
                />
              </div>

              <div className="space-y-2">
                <Label>Return, Exchange & Refund Policy</Label>
                <Textarea
                  rows={3}
                  value={profile.returnPolicy || ""}
                  onChange={(e) => setProfile({ ...profile, returnPolicy: e.target.value })}
                  placeholder="e.g. 7 days exchange policy. Items must be unworn with tags. No refunds on sale items..."
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Accepted Payment Methods</CardTitle>
                <CardDescription>Select payment options accepted by your business.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {PAYMENT_OPTIONS.map((method) => {
                  const isChecked = (profile.paymentMethods || []).includes(method);
                  return (
                    <div
                      key={method}
                      onClick={() => togglePaymentMethod(method)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        isChecked
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <span className="text-sm font-medium">{method}</span>
                      <div
                        className={`h-5 w-5 rounded border flex items-center justify-center ${
                          isChecked ? "bg-emerald-600 border-emerald-600 text-white" : "border-muted-foreground"
                        }`}
                      >
                        {isChecked && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Frequently Asked Questions (FAQs)</CardTitle>
                <CardDescription>Provide exact answers to common customer inquiries.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Question (e.g. Do you offer cash on delivery?)"
                    value={newFaq.question}
                    onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                  />
                  <Textarea
                    rows={2}
                    placeholder="Answer (e.g. Yes, we offer cash on delivery all over Pakistan.)"
                    value={newFaq.answer}
                    onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                  />
                  <Button onClick={handleAddFaq} size="sm" variant="outline" className="w-full gap-1.5">
                    <Plus className="h-4 w-4" /> Add FAQ Item
                  </Button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {(profile.faqs || []).map((faq: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-lg border border-border bg-muted/30 relative group">
                      <button
                        onClick={() => handleRemoveFaq(idx)}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <p className="text-xs font-semibold pr-6">Q: {faq.question}</p>
                      <p className="text-xs text-muted-foreground mt-1">A: {faq.answer}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 4: SERVICES & APPOINTMENTS */}
      {activeTab === "services" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
            <div>
              <h3 className="text-lg font-semibold">Services & Booking Rules</h3>
              <p className="text-sm text-muted-foreground">
                Define the services you offer, working hours, and appointment slots for AI booking.
              </p>
            </div>
            <Button onClick={openNewServiceModal} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" /> Add Service
            </Button>
          </div>

          {/* Working Schedule Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" /> Working Schedule & Operating Hours
              </CardTitle>
              <CardDescription>
                The AI will ONLY offer time slots within these days and hours.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Working Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = (profile.workingDays || []).includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWorkingDay(day)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          isSelected
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>Opening Time</Label>
                  <Input
                    type="time"
                    value={profile.openingTime || "09:00"}
                    onChange={(e) => setProfile({ ...profile, openingTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Closing Time</Label>
                  <Input
                    type="time"
                    value={profile.closingTime || "18:00"}
                    onChange={(e) => setProfile({ ...profile, closingTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slot Duration (Minutes)</Label>
                  <Select
                    value={String(profile.slotDuration || 30)}
                    onValueChange={(val) => setProfile({ ...profile, slotDuration: Number(val) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Slot duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 Minutes</SelectItem>
                      <SelectItem value="30">30 Minutes</SelectItem>
                      <SelectItem value="45">45 Minutes</SelectItem>
                      <SelectItem value="60">60 Minutes (1 Hour)</SelectItem>
                      <SelectItem value="90">90 Minutes (1.5 Hours)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>Booking Rules</Label>
                  <Input
                    value={profile.bookingRules || ""}
                    onChange={(e) => setProfile({ ...profile, bookingRules: e.target.value })}
                    placeholder="e.g. Minimum 2 hours advance booking, max 2 people per slot"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Appointment Cancellation Policy</Label>
                  <Input
                    value={profile.appointmentPolicies || ""}
                    onChange={(e) => setProfile({ ...profile, appointmentPolicies: e.target.value })}
                    placeholder="e.g. Cancel at least 1 hour prior. Rescheduling allowed once."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Services List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s) => (
              <Card key={s.id} className="relative group hover:border-emerald-500/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge variant="secondary" className="text-xs mb-1">
                        {s.category || "General"}
                      </Badge>
                      <CardTitle className="text-base">{s.name}</CardTitle>
                    </div>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {s.currency} {s.price}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  {s.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {s.durationMinutes} mins
                    </span>
                    {s.staff && (
                      <span className="bg-muted px-2 py-0.5 rounded text-xs">
                        Staff: {s.staff}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end gap-1 pt-2 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditServiceModal(s)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteService(s.id)}
                      className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* PRODUCT MODAL */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
            <DialogDescription>
              Configure the product details, prices, and variants for your AI store catalog.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Input
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g. Premium Cotton T-Shirt"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  placeholder="e.g. Clothing, Shoes, Electronics"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Base Price ({productForm.currency}) *</Label>
                <Input
                  type="number"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                  placeholder="1500"
                />
              </div>
              <div className="space-y-2">
                <Label>Total Available Stock</Label>
                <Input
                  type="number"
                  value={productForm.stock}
                  onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label>SKU / Barcode</Label>
                <Input
                  value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                  placeholder="TSH-001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                placeholder="Product description, fabric, dimensions, or features..."
              />
            </div>

            {/* VARIANTS SECTION */}
            <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/20">
              <div className="flex justify-between items-center">
                <Label className="font-semibold text-xs uppercase tracking-wide">
                  Sizes / Colors / Variants
                </Label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Input
                  placeholder="Size (e.g. M, L)"
                  value={variantInput.size}
                  onChange={(e) => setVariantInput({ ...variantInput, size: e.target.value })}
                />
                <Input
                  placeholder="Color (e.g. Black)"
                  value={variantInput.color}
                  onChange={(e) => setVariantInput({ ...variantInput, color: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Price"
                  value={variantInput.price}
                  onChange={(e) => setVariantInput({ ...variantInput, price: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Stock"
                  value={variantInput.stock}
                  onChange={(e) => setVariantInput({ ...variantInput, stock: e.target.value })}
                />
                <Button onClick={handleAddVariant} type="button" size="sm" variant="outline" className="col-span-2 sm:col-span-1">
                  Add
                </Button>
              </div>

              {productForm.variants && productForm.variants.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  {productForm.variants.map((v: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs p-2 bg-background rounded border border-border">
                      <span className="font-medium">
                        {v.name} {v.size ? `• Size: ${v.size}` : ""} {v.color ? `• Color: ${v.color}` : ""}
                      </span>
                      <div className="flex items-center gap-3">
                        <span>Price: {v.price || productForm.price}</span>
                        <span>Stock: {v.stock || productForm.stock}</span>
                        <button type="button" onClick={() => handleRemoveVariant(idx)} className="text-rose-500 hover:text-rose-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProductModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProduct} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Save Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SERVICE MODAL */}
      <Dialog open={serviceModalOpen} onOpenChange={setServiceModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Service" : "Add Service"}</DialogTitle>
            <DialogDescription>
              Configure service duration, price, and staff provider for appointments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Service Name *</Label>
              <Input
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                placeholder="e.g. Haircut & Styling, Dental Consultation"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price ({serviceForm.currency})</Label>
                <Input
                  type="number"
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm({ ...serviceForm, price: Number(e.target.value) })}
                  placeholder="2000"
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (Mins)</Label>
                <Input
                  type="number"
                  value={serviceForm.durationMinutes}
                  onChange={(e) => setServiceForm({ ...serviceForm, durationMinutes: Number(e.target.value) })}
                  placeholder="30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Staff / Provider (Optional)</Label>
              <Input
                value={serviceForm.staff}
                onChange={(e) => setServiceForm({ ...serviceForm, staff: e.target.value })}
                placeholder="e.g. Dr. Ahmed, Sarah"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                placeholder="Service details..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveService} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Save Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayoutClient>
  );
}
