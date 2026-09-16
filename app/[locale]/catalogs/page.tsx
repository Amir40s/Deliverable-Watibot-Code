"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} 
from "@/components/ui/dialog";
import {
  ShoppingBag,
  Info,
  Link2,
  ExternalLink,
  Trash2,
  Send,
  RefreshCw,
  Package,
  Settings,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Facebook,
  Edit3
} from "lucide-react";
import { toast } from "sonner";

interface SyncedProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  sku: string | null;
  status: string;
  platform: string | null;
}



export default function CatalogsPage() {
  const t = useTranslations("CommerceCatalogs");

  // Connection states
  const [wabaSettings, setWabaSettings] = useState<any>(null);
  const [catalogs, setCatalogs] = useState<MetaCatalog[]>([]);
  const [products, setProducts] = useState<SyncedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingFromMeta, setIsSyncingFromMeta] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCatalogId, setImportCatalogId] = useState("");





  // Manual product modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SyncedProduct | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    currency: "PKR",
    sku: "",
    imageUrl: ""
  });

  // Fetch initial WABA settings & linked catalogs & products
  const fetchAllData = async (showToast = false) => {
    setIsLoading(true);
    try {
      // 1. Fetch WABA configuration
      const settings = await getWabaSettings();
      setWabaSettings(settings);

      if (settings.isConnected) {
        // 2. Fetch catalogs directly from Meta
        const catalogRes = await getLinkedCatalogs();
        if (catalogRes.success && catalogRes.catalogs) {
          setCatalogs(catalogRes.catalogs);
        } else if (catalogRes.error) {
          toast.error(`Meta API Error: ${catalogRes.error}`);
        }

        // 3. Fetch synced local products
        const localProducts = await getLocalProducts();
        setProducts(localProducts);


      }

      if (showToast) {
        toast.success(t("commerceDataReloaded"));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t("failedToLoadCatalog"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Pre-load and initialize Facebook SDK dynamically once WABA settings are fetched
  useEffect(() => {
    if (!wabaSettings) return;

    const appId = wabaSettings.metaAppId;
    if (!appId) {
      console.warn("Meta App ID is missing in configuration. Cannot initialize Facebook SDK.");
      return;
    }

    const loadSdk = () => {
      const windowAny = window as any;
      if (!windowAny.FB) {
        // If the script is already added in DOM (e.g. by another page navigation), just wait and init
        if (document.getElementById("facebook-jssdk")) {
          const checkFB = setInterval(() => {
            if (windowAny.FB) {
              clearInterval(checkFB);
              windowAny.FB.init({
                appId,
                cookie: true,
                autoLogAppEvents: true,
                xfbml: true,
                version: "v21.0",
              });
              console.log("[Meta SDK] FB SDK initialized from existing script.");
            }
          }, 100);
          setTimeout(() => clearInterval(checkFB), 10000); // 10s safety timeout
        } else {
          // script is completely missing, append it
          const script = document.createElement("script");
          script.id = "facebook-jssdk";
          script.src = "https://connect.facebook.net/en_US/sdk.js";
          script.async = true;
          script.defer = true;
          script.onload = () => {
            windowAny.FB.init({
              appId,
              cookie: true,
              autoLogAppEvents: true,
              xfbml: true,
              version: "v21.0",
            });
            console.log("[Meta SDK] FB SDK loaded and initialized successfully.");
          };
          document.body.appendChild(script);
        }
      } else {
        // FB is already loaded, just re-initialize it with the target appId
        windowAny.FB.init({
          appId,
          cookie: true,
          autoLogAppEvents: true,
          xfbml: true,
          version: "v21.0",
        });
        console.log("[Meta SDK] FB SDK re-initialized successfully.");
      }
    };

    loadSdk();
  }, [wabaSettings]);



  // Open modal in Create mode
  const openAddProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: "",
      description: "",
      price: "",
      currency: "PKR",
      sku: "",
      imageUrl: ""
    });
    setIsProductModalOpen(true);
  };

  // Open modal in Edit mode
  const openEditProductModal = (product: SyncedProduct) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      currency: product.currency || "PKR",
      sku: product.sku || "",
      imageUrl: product.imageUrl || ""
    });
    setIsProductModalOpen(true);
  };

  // Handle save manual product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      toast.error(t("requiredName"));
      return;
    }

    const priceNum = parseFloat(productForm.price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error(t("invalidPrice"));
      return;
    }

    setIsSavingProduct(true);
    try {
      let res;
      if (editingProduct) {
        res = await updateManualProduct(editingProduct.id, {
          name: productForm.name,
          description: productForm.description,
          price: priceNum,
          currency: productForm.currency,
          sku: productForm.sku,
          imageUrl: productForm.imageUrl
        });
      } else {
        res = await createManualProduct({
          name: productForm.name,
          description: productForm.description,
          price: priceNum,
          currency: productForm.currency,
          sku: productForm.sku,
          imageUrl: productForm.imageUrl
        });
      }

      if (res.success) {
        if ((res as any).warning) {
          toast.warning((res as any).warning, { duration: 6000 });
        } else {
          toast.success(editingProduct ? t("toastManualProductUpdated") : t("toastManualProductCreated"));
        }
        setIsProductModalOpen(false);
        await fetchAllData();
      } else {
        toast.error(res.error || t("failedToSave"));
      }
    } catch (err: any) {
      toast.error(err.message || t("saveError"));
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Handle delete custom product
  const handleDeleteProduct = async (productId: string) => {
    if (!confirm(t("confirmDelete"))) {
      return;
    }

    try {
      const res = await deleteManualProduct(productId);
      if (res.success) {
        toast.success(t("productDeleted"));
        await fetchAllData();
      } else {
        toast.error(res.error || t("failedToDelete"));
      }
    } catch (err: any) {
      toast.error(err.message || t("deleteError"));
    }
  };

  // Handle automatic Facebook login for Catalog Token
  const handleConnectFB = () => {
    if (!(window as any).FB) {
      toast.error(t("fbSdkNotLoaded"));
      return;
    }

    const scopes = "whatsapp_business_management,whatsapp_business_messaging,catalog_management,business_management";

    (window as any).FB.login(
      (response: any) => {
        (async () => {
          const accessToken = response?.authResponse?.accessToken;
          if (!accessToken) {
            toast.error(t("fbAuthFailed"));
            return;
          }

          const toastId = toast.loading(t("exchangingToken"));
          try {
            const res = await connectCatalogMetaAccount(accessToken);
            if (res.success) {
              toast.success(t("authorizedAndSaved"), { id: toastId });
              await fetchAllData();
            } else {
              toast.error(res.error || t("failedToSaveToken"), { id: toastId });
            }
          } catch (err: any) {
            toast.error(err.message || t("authError"), { id: toastId });
          }
        })();
      },
      {
        scope: scopes,
        auth_type: "rerequest",
        return_scopes: true,
      }
    );
  };





  const handlePullFromMeta = async (catalogId?: string) => {
    setIsSyncingFromMeta(true);
    const targetCatalogId = catalogId?.trim();
    const toastId = toast.loading(t("syncingProducts"));
    try {
      const res = await pullProductsFromMetaCatalog(targetCatalogId || undefined);
      if (res.success) {
        toast.success(t("importSuccess", { count: res.count || 0 }), { id: toastId });
        setIsImportModalOpen(false);
        setImportCatalogId("");
        await fetchAllData();
      } else {
        toast.error(res.error || t("failedToPull"), { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || t("pullError"), { id: toastId });
    } finally {
      setIsSyncingFromMeta(false);
    }
  };

  // 1. Loading state view
  if (isLoading && wabaSettings === null) {
    return (
      <DashboardLayoutClient mainClassName="pb-16 antialiased">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold animate-pulse">
            {t("fetchingState")}
          </p>
        </div>
      </DashboardLayoutClient>
    );
  }

  // 2. Unconnected state view (WABA not connected)
  if (wabaSettings && !wabaSettings.isConnected) {
    return (
      <DashboardLayoutClient mainClassName="pb-16 antialiased">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
                <ShoppingBag className="w-3.5 h-3.5 text-red-600" />
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">{t("commerceStatus")}</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#111827] dark:text-white">
                {t("productCatalogs")}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-bold max-w-xl">
                {t("unconnectedSubtitle")}
              </p>
            </div>
            <Button
              onClick={() => fetchAllData(true)}
              variant="outline"
              className="h-11 px-6 rounded-xl border-slate-200 dark:border-slate-800 text-[#374151] dark:text-slate-300 font-bold text-[10px] uppercase tracking-widest gap-2 bg-white dark:bg-slate-900 shadow-sm hover:bg-slate-50 transition-all"
            >
              <RefreshCw className="w-4 h-4 text-emerald-500" />
              {t("syncState")}
            </Button>
          </div>

          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden max-w-xl w-full shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col">
              <div className="bg-[#EFF6FF] dark:bg-blue-500/10 p-12 md:p-16 text-center space-y-8 flex flex-col items-center">
                <div className="w-24 h-24 rounded-[32px] bg-white dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-blue-500/30 shadow-inner group transition-all">
                  <ShoppingBag className="w-10 h-10 text-blue-600 group-hover:scale-110 transition-transform" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-white">{t("metaConnectionRequired")}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-bold leading-relaxed max-w-sm mx-auto">
                    {t("metaConnectionRequiredDesc")}
                  </p>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-8 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <Button 
                  onClick={() => window.location.href = "/dashboard/profile"}
                  className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] gap-3"
                >
                  <Link2 className="w-4 h-4" />
                  {t("configureCredentials")}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => window.open("https://developers.facebook.com/docs/whatsapp/cloud-api/get-started", "_blank")}
                  className="w-full h-12 rounded-xl text-[10px] font-bold text-slate-400 hover:text-emerald-600 uppercase tracking-widest gap-2 transition-colors"
                >
                  {t("learnCommerce")}
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayoutClient>
    );
  }

  // 3. Connected state view (WABA integrated)
  return (
    <DashboardLayoutClient mainClassName="pb-16 antialiased">
      <div className="flex flex-col gap-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 dark:border-slate-800 pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{t("wabaLinked")}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#111827] dark:text-white">
              {t("commerceCatalogTitle")}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-bold max-w-xl">
              {t("commerceCatalogSubtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setIsImportModalOpen(true)}
              variant="outline"
              className="h-11 px-4 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 font-bold text-[10px] uppercase tracking-widest gap-2 bg-white dark:bg-slate-900 shadow-sm hover:bg-slate-50 transition-all"
            >
              <RefreshCw className="w-4 h-4 text-blue-500" />
              {t("importFromMeta")}
            </Button>
            <Button
              onClick={openAddProductModal}
              className="h-11 px-5 bg-[#00B074] hover:bg-[#009662] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest gap-2 shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.01]"
            >
              <Plus className="w-4 h-4" />
              {t("addCustomProduct")}
            </Button>
          </div>
        </div>



        <Card className="rounded-[28px] border-slate-200/80 dark:border-slate-850 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
          <div className="p-6 bg-slate-50/30 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-[#111827] dark:text-white">{t("catalogInventory")}</h4>
                <p className="text-slate-400 text-xs mt-0.5">{t("catalogInventoryDesc")}</p>
              </div>

            </div>
          </div>
          <CardContent className="p-6">

                {products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-200/40">
                      <FileSpreadsheet className="w-7 h-7 text-slate-400" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-[#111827] dark:text-white">{t("noProductsFound")}</h4>
                      <p className="text-slate-400 text-sm max-w-sm">
                        {t("noProductsDesc")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <th className="py-4 pl-2">{t("productTableProduct")}</th>
                          <th className="py-4">{t("productTableSku")}</th>
                          <th className="py-4">{t("productTablePrice")}</th>
                          <th className="py-4">{t("productTableStatus")}</th>
                          <th className="py-4 pr-2 text-right">{t("productTableActions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-[#111827] dark:text-slate-300 font-bold">
                        {products.map((product) => (
                          <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                            <td className="py-4 pl-2 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-100 dark:border-slate-800 flex-shrink-0 flex items-center justify-center">
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <Package className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                              <div className="space-y-0.5">
                                <div className="text-sm font-bold text-[#111827] dark:text-white">
                                  {product.name}
                                </div>
                                <div className="text-slate-400 text-[10px] max-w-xs truncate">
                                  {product.description || t("noDescriptionProvided")}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 font-mono text-xs text-slate-500">
                              {product.sku || "N/A"}
                            </td>
                            <td className="py-4 text-emerald-600 dark:text-emerald-500 font-extrabold">
                              {product.currency} {product.price.toFixed(2)}
                            </td>
                            <td className="py-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                product.status === "active"
                                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              }`}>
                                {product.status}
                              </span>
                            </td>
                            <td className="py-4 pr-2 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => openEditProductModal(product)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                                  title={t("editProductTooltip")}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(product.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                                  title={t("deleteProductTooltip")}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

          </CardContent>
</Card>
      </div>

      {/* Manual Product Overlay Modal (Radix Dialog) */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent
          className="sm:max-w-[480px] p-0 bg-white dark:bg-slate-900 border-none rounded-[32px] overflow-hidden"
          style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
        >
          <div className="p-8 space-y-6">
            <DialogHeader>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-2">
                <Package className="w-6 h-6 text-emerald-600" />
              </div>
              <DialogTitle className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {editingProduct ? t("editCrmProduct") : t("addCrmProduct")}
              </DialogTitle>
              <p className="text-slate-400 text-xs leading-relaxed font-bold">
                {t("configureManualProductsDesc")}
              </p>
            </DialogHeader>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-350 ml-1 uppercase tracking-wider">
                  {t("productName")}
                </label>
                <input
                  required
                  type="text"
                  placeholder={t("productNamePlaceholder")}
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full h-12 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-xl px-5 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400/80"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-350 ml-1 uppercase tracking-wider">
                    {t("price")}
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder={t("pricePlaceholder")}
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    className="w-full h-12 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-xl px-5 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400/80"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-350 ml-1 uppercase tracking-wider">
                    {t("currency")}
                  </label>
                  <input
                    required
                    type="text"
                    placeholder={t("currencyPlaceholder")}
                    value={productForm.currency}
                    onChange={(e) => setProductForm({ ...productForm, currency: e.target.value })}
                    className="w-full h-12 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-xl px-5 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400/80"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-350 ml-1 uppercase tracking-wider">
                  {t("skuLabel")}
                </label>
                <input
                  type="text"
                  placeholder={t("skuPlaceholder")}
                  value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                  className="w-full h-12 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-xl px-5 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400/80 font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-350 ml-1 uppercase tracking-wider">
                  {t("productImageUrl")}
                </label>
                <input
                  type="url"
                  placeholder={t("productImageUrlPlaceholder")}
                  value={productForm.imageUrl}
                  onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                  className="w-full h-12 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-xl px-5 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400/80"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-350 ml-1 uppercase tracking-wider">
                  {t("description")}
                </label>
                <textarea
                  placeholder={t("descriptionPlaceholder")}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full h-20 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-xl px-5 py-3 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400/80 resize-none text-sm"
                />
              </div>

              <div className="pt-4 flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  variant="ghost"
                  className="flex-1 h-12 rounded-xl font-bold text-[13px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border-none"
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingProduct || !productForm.name.trim()}
                  className="flex-1 h-12 bg-[#00B074] hover:bg-[#009662] text-white text-[13px] font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all active:scale-95 border-none gap-1.5"
                >
                  {isSavingProduct ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {t("saving")}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {editingProduct ? t("updateProduct") : t("saveProduct")}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import from Meta Modal (Radix Dialog) */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent
          className="sm:max-w-[440px] p-0 bg-white dark:bg-slate-900 border-none rounded-[32px] overflow-hidden"
          style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
        >
          <div className="p-8 space-y-6">
            <DialogHeader>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-2">
                <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
              <DialogTitle className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {t("importMetaCatalog")}
              </DialogTitle>
              <p className="text-slate-400 text-xs leading-relaxed font-bold">
                {t("importMetaCatalogDesc")}
              </p>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePullFromMeta(importCatalogId);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-350 ml-1 uppercase tracking-wider">
                  {t("metaCatalogId")}
                </label>
                <input
                  required
                  type="text"
                  placeholder={t("metaCatalogIdPlaceholder")}
                  value={importCatalogId}
                  onChange={(e) => setImportCatalogId(e.target.value)}
                  className="w-full h-12 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-xl px-5 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-slate-400/80 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-4 flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  variant="ghost"
                  className="flex-1 h-12 rounded-xl font-bold text-[13px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border-none"
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isSyncingFromMeta || !importCatalogId.trim()}
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-95 border-none gap-1.5"
                >
                  {isSyncingFromMeta ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {t("importing")}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      {t("importProducts")}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayoutClient>
  );
}
