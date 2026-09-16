"use client";

import React, { useState, useRef } from "react";
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
  X,
  Users,
  Database
} from "lucide-react";
import { ModalButton } from "@/components/ui/modal-button";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { getGroups, bulkImportContactsToGroup } from "@/app/actions/groups";
import { getTags } from "@/app/actions/tags";

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TARGET_ATTRIBUTES = [
  { key: "name", label: "Name", required: false },
  { key: "phoneNumber", label: "Mobile Number", required: true },
  { key: "email", label: "Email", required: false },
  { key: "dob", label: "Date of Birth", required: false },
  { key: "tags", label: "Tags / Labels", required: false, isTags: true },
  { key: "source", label: "Source", required: false },
];

export function ImportContactsModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportContactsModalProps) {
  const t = useTranslations('Contacts');
  const [isLoading, setIsLoading] = useState(false);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [defaultCountryCode, setDefaultCountryCode] = useState("+91");
  const [replaceTags, setReplaceTags] = useState(false);
  const [fileName, setFileName] = useState("");
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [customFields, setCustomFields] = useState<string[]>([]);
  const [crmTags, setCrmTags] = useState<any[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [progressPercent, setProgressPercent] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    imported: number;
    errors: string[];
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const fetchGroupsAndFields = async () => {
      try {
        const [res, fields, fetchedTags] = await Promise.all([
           getGroups(),
           getCustomAttributes(),
           getTags()
        ]);
        if (res.groups) setGroups(res.groups);
        if (fields) setCustomFields(fields);
        if (fetchedTags) setCrmTags(fetchedTags);
      } catch (err) {
        console.error("Failed to fetch groups or fields:", err);
      }
    };
    if (isOpen) {
      fetchGroupsAndFields();
    }
  }, [isOpen]);

  const dynamicAttributes = [
    ...TARGET_ATTRIBUTES,
    ...customFields.map(field => ({ key: `custom_${field}`, label: field, required: false, isCustom: true }))
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const dataBuffer = event.target?.result;
        const wb = XLSX.read(dataBuffer, { type: "array" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          toast.error("The uploaded file does not contain any data rows.");
          return;
        }

         const headers = Array.from(
          new Set(data.flatMap((row) => Object.keys(row as object)))
        );
        const initialMappings: Record<string, string> = {
          name: "",
          phoneNumber: "",
          email: "",
          dob: "",
          tags: "",
          source: "",
        };

        setRawHeaders(headers);
        setRawRows(data);
        setMappings(initialMappings);
      } catch (error) {
        console.error("Error parsing file:", error);
        toast.error(
          "Failed to parse file. Please ensure it is a valid Excel or CSV sheet."
        );
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    const selectedPhoneHeader = mappings["phoneNumber"];
    if (!selectedPhoneHeader || selectedPhoneHeader === "none" || selectedPhoneHeader === "") {
      toast.error("Please map a CSV column to 'Mobile Number'. It is a required field.");
      return;
    }

    setIsLoading(true);
    setProgressPercent(0);
    setProcessedCount(0);
    setSuccessCount(0);
    setErrorCount(0);
    setErrorDetails([]);
    setImportSummary(null);

    try {
      const contactsToCreate = rawRows
        .map((row, idx) => {
          const selectedNameHeader = mappings["name"];
          const name = (selectedNameHeader && selectedNameHeader !== "none" && selectedNameHeader !== "") ? String(row[selectedNameHeader] || "") : "";
          
          let rawPhone = row[selectedPhoneHeader] !== undefined && row[selectedPhoneHeader] !== null ? String(row[selectedPhoneHeader]) : "";
          let formattedPhone = rawPhone.trim();

          const emailHeader = mappings["email"];
          const dobHeader = mappings["dob"];
          const sourceHeader = mappings["source"];

          const email = (emailHeader && emailHeader !== "none" && emailHeader !== "") ? String(row[emailHeader] || "") : "";
          const dob = (dobHeader && dobHeader !== "none" && dobHeader !== "") ? String(row[dobHeader] || "") : "";
          const source = (sourceHeader && sourceHeader !== "none" && sourceHeader !== "") ? String(row[sourceHeader] || "") : "";

          let contactCustomAttrs: Record<string, string> = {};
          customFields.forEach(field => {
             const headerKey = mappings[`custom_${field}`];
             if (headerKey && headerKey !== "none" && headerKey !== "") {
                 contactCustomAttrs[field] = String(row[headerKey] || "");
             }
          });

          return {
            name: name || formattedPhone || "Imported Contact",
            phoneNumber: formattedPhone,
            email: email || undefined,
            notes: `DOB: ${dob}, Source: ${source}`,
            customAttributes: Object.keys(contactCustomAttrs).length > 0 ? contactCustomAttrs : undefined,
          };
        })
        .filter((c) => c.phoneNumber !== "");

      if (contactsToCreate.length === 0) {
        toast.error("No contacts found. The mapped Mobile Number column is completely empty in your file.");
        setIsLoading(false);
        return;
      }

      const totalContacts = contactsToCreate.length;
      setTotalToProcess(totalContacts);

       const BATCH_SIZE = 100;
      let totalImported = 0;
      let allErrors: string[] = [];

      for (let i = 0; i < totalContacts; i += BATCH_SIZE) {
        const chunk = contactsToCreate.slice(i, i + BATCH_SIZE);
        
        const result = selectedGroupId 
          ? await bulkImportContactsToGroup(selectedGroupId, chunk, selectedTagIds)
          : await bulkCreateContacts(chunk, selectedTagIds);

        if (!result.success) {
          const errorMsg = result.error || "Failed to process batch";
          toast.error(errorMsg);
          
          allErrors.push(`Import stopped: ${errorMsg}`);
          const remainingContacts = contactsToCreate.slice(i);
          allErrors.push(...remainingContacts.map(c => `${c.name || c.phoneNumber}: Skipped due to import termination`));

          setImportSummary({
            total: totalContacts,
            imported: totalImported,
            errors: allErrors
          });
          
          setErrorCount(allErrors.length);
          setErrorDetails(allErrors);
          setIsLoading(false);
          return;
        }

        totalImported += (result as { createdCount: number }).createdCount;
        if (result.errors && result.errors.length > 0) {
          allErrors.push(...result.errors);
        }

        const targetProcessed = Math.min(i + BATCH_SIZE, totalContacts);
        
         for (let p = i + 1; p <= targetProcessed; p++) {
          setProcessedCount(p);
          setProgressPercent(Math.round((p / totalContacts) * 100));
          await new Promise(resolve => setTimeout(resolve, 5)); // faster 5ms delay per contact
        }

        setSuccessCount(totalImported);
        setErrorCount(allErrors.length);
        setErrorDetails(allErrors);
      }

      setImportSummary({
        total: totalContacts,
        imported: totalImported,
        errors: allErrors
      });

       await new Promise(resolve => setTimeout(resolve, 600));

      toast.success(`Successfully processed import of ${totalContacts} contacts`);
      onSuccess();
    } catch (error) {
      console.error("Import failed:", error);
      toast.error("Failed to import contacts");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setRawRows([]);
    setRawHeaders([]);
    setMappings({});
    setFileName("");
    setReplaceTags(false);
    setSelectedGroupId("");
    setSelectedTagIds([]);
    setProgressPercent(0);
    setProcessedCount(0);
    setTotalToProcess(0);
    setSuccessCount(0);
    setErrorCount(0);
    setErrorDetails([]);
    setImportSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-3xl bg-white dark:bg-slate-900 !border-none !border-0 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] p-0 plus-jakarta-forced animate-in fade-in duration-200"
        style={{ border: "none" }}
      >
        <DialogHeader className="p-6 pb-4 border-b border-gray-150 dark:border-slate-800">
          <DialogTitle className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2.5">
            <div className="p-2 bg-[#00B074]/10 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-[#00B074]" />
            </div>
            {t('importExcelCSV')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-7 space-y-6">
          {isLoading ? (
             
            <div className="flex flex-col items-center justify-center py-12 px-6 space-y-6 animate-in fade-in duration-300">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-800" />
                <div className="absolute inset-0 rounded-full border-4 border-t-[#00B074] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                <span className="text-xl font-black text-slate-800 dark:text-white">
                  {progressPercent}%
                </span>
              </div>
              <div className="text-center space-y-2">
                <h4 className="text-base font-black text-slate-800 dark:text-white tracking-wide">
                  Importing Contacts...
                </h4>
                <p className="text-xs text-slate-400 font-semibold max-w-sm leading-relaxed">
                  Processed <span className="text-[#00B074] font-bold">{processedCount}</span> of <span className="font-bold text-slate-700 dark:text-slate-300">{totalToProcess}</span> rows. Please keep this window open.
                </p>
              </div>
              <div className="w-full max-w-md bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="bg-gradient-to-r from-[#00B074] to-[#10B981] h-full rounded-full transition-all duration-300 ease-out shadow-sm"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : importSummary ? (
             <div className="flex flex-col py-6 px-4 space-y-6 animate-in zoom-in-95 duration-200">
              <div className="text-center space-y-2">
                {successCount === 0 ? (
                  
                  <>
                    <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 mb-3 animate-bounce">
                      <AlertCircle className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <h4 className="text-base font-black text-rose-600 dark:text-rose-455 tracking-wide">
                      Import Stopped / Failed
                    </h4>
                    <p className="text-xs text-slate-400 font-semibold max-w-md mx-auto leading-relaxed">
                      No contacts could be imported. Please review the error or quota limits below.
                    </p>
                  </>
                ) : errorCount > 0 ? (
                  /* Partial Success */
                  <>
                    <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-500 border border-amber-100 dark:border-amber-900/50 mb-3">
                      <AlertCircle className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <h4 className="text-base font-black text-amber-600 dark:text-amber-500 tracking-wide">
                      Import Partially Completed
                    </h4>
                    <p className="text-xs text-slate-400 font-semibold max-w-md mx-auto leading-relaxed">
                      Some contacts were successfully imported, but others were skipped or failed.
                    </p>
                  </>
                ) : (
                  /* Full Success */
                  <>
                    <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 mb-3">
                      <CheckCircle className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <h4 className="text-base font-black text-emerald-600 dark:text-emerald-400 tracking-wide">
                      Import Process Completed
                    </h4>
                    <p className="text-xs text-slate-400 font-semibold max-w-md mx-auto leading-relaxed">
                      All contacts have been successfully imported.
                    </p>
                  </>
                )}
              </div>
                {successCount === 0 && errorDetails.length > 0 && (
                <div className="bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100/60 dark:border-rose-900/30 p-4 rounded-2xl max-w-md mx-auto w-full flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-[10px] font-bold text-rose-750 dark:text-rose-400 uppercase tracking-wider">Reason for Termination</h5>
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-semibold leading-relaxed">
                      {errorDetails[0].startsWith("Import stopped: ") ? errorDetails[0].substring(16) : errorDetails[0]}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : !rawRows.length ? (
             <div
              className="border-2 border-dashed border-[#00B074]/30 dark:border-emerald-700/80 rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-emerald-50/5 dark:hover:bg-slate-800/20 transition-all group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <div className="bg-[#00B074]/10 p-5 rounded-2xl mb-6 group-hover:scale-105 transition-all">
                <Upload className="w-8 h-8 text-[#00B074]" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white mb-2">
                {t('clickToUpload')}
              </h3>
              <p className="text-xs text-slate-400 font-semibold max-w-sm">
                {t('supportedFormats')}
              </p>
              
              <div className="mt-8 bg-[#F8FAFC] dark:bg-slate-800/40 border border-slate-100/50 dark:border-slate-800/50 px-8 py-5 rounded-[1.5rem] w-full max-w-lg flex flex-col items-center justify-center">
                <p className="font-semibold text-slate-400  tracking-wider text-[10px] mb-2">
                  {t('recommendedHeaders')}
                </p>
                <p className="font-semibold text-xs text-slate-500 dark:text-slate-400">
                  {t('headersList')}
                </p>
              </div>
            </div>
          ) : !importSummary ? (
            <div className="space-y-6">
              {/* File Info Card */}
              <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-100/55 dark:border-slate-800/55 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm">
                    {fileName}
                  </h4>
                  <p className="text-xs text-slate-400 font-semibold mt-1">
                    <span className="text-[#00B074] font-bold">{rawRows.length}</span> contacts detected
                  </p>
                </div>
                <button
                  onClick={() => {
                    setRawRows([]);
                    setRawHeaders([]);
                    setFileName("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-350 dark:hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 transition-all active:scale-95 shadow-sm"
                >
                  Change File
                </button>
              </div>

              {/* Group Selector */} 
              <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-[#00B074]/10 rounded-xl mt-0.5">
                    <Users className="w-5 h-5 text-[#00B074]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                      {t("assignToGroup", { defaultValue: "Assign to Group (Optional)" })}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      {t("assignToGroupDesc", { defaultValue: "Automatically add all imported contacts to a specific group." })}
                    </p>
                  </div>
                </div>
                
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-xs font-semibold text-slate-750 dark:text-slate-200 outline-none cursor-pointer appearance-none mt-3 ml-11 focus:ring-2 focus:ring-[#00B074]/20 focus:border-[#00B074]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='m6 9 6 6 6-6'/%3e%3c/svg%3e")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 16px center",
                    backgroundSize: "16px",
                    paddingRight: "40px",
                    width: "calc(100% - 44px)"
                  }}
                >
                  <option value="" className="text-slate-400 dark:bg-slate-900">
                    Select Group (Optional)
                  </option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id} className="text-slate-800 dark:text-slate-100 dark:bg-slate-900 font-semibold">
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-rose-500/10 rounded-xl mt-0.5">
                    <Database className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Header identifiers</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">Map your Excel columns to contact attributes.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-[10px] font-semibold text-slate-400  tracking-wider">
                    Attributes
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400  tracking-wider">
                    Map from CSV / Excel Column
                  </span>
                </div>

                <div className="space-y-3.5 pr-1">
                  {dynamicAttributes.map((attr) => (
                    <div key={attr.key} className="grid grid-cols-2 gap-8 items-center">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-355 truncate flex items-center gap-1">
                        {attr.label}
                        {attr.required && <span className="text-red-500 font-bold text-xs">*</span>}
                        {(attr as any).isCustom && <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded ml-2 uppercase font-bold tracking-wider">Custom</span>}
                      </span>
                      <div>
                        {(attr as any).isTags ? (
                          <div className="flex flex-wrap gap-2 w-full max-w-sm">
                            {crmTags.length === 0 ? (
                               <span className="text-[11px] text-slate-400 font-bold bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-700 w-full text-center">No tags in CRM</span>
                            ) : crmTags.map(tag => {
                               const isSelected = selectedTagIds.includes(tag.id);
                               return (
                                 <button
                                   key={tag.id}
                                   onClick={() => setSelectedTagIds(prev => isSelected ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                                   className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${isSelected ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700/50'}`}
                                 >
                                   {tag.name}
                                 </button>
                               )
                            })}
                          </div>
                        ) : (
                          <select
                            value={mappings[attr.key] || ""}
                            onChange={(e) => {
                              setMappings((prev) => ({
                                ...prev,
                                [attr.key]: e.target.value,
                              }));
                            }}
                            className="w-full h-11 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-xl px-4 text-xs font-semibold text-slate-750 dark:text-slate-200 outline-none cursor-pointer appearance-none transition-all hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                            style={{
                              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='m6 9 6 6 6-6'/%3e%3c/svg%3e")`,
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "right 16px center",
                              backgroundSize: "16px",
                              paddingRight: "40px"
                            }}
                          >
                            <option value="" className="text-slate-400 dark:bg-slate-900">
                              Select Column
                            </option>
                            <option value="none" className="text-slate-450 dark:bg-slate-900 font-medium">
                              Ignore Column / Empty
                            </option>
                            {rawHeaders.map((h) => (
                              <option key={h} value={h} className="text-slate-800 dark:text-slate-100 dark:bg-slate-900 font-bold">
                                {h}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>    
            </div>
          ) : null}
        </div>
        
        <div className="p-6 border-t border-gray-150 dark:border-slate-800 flex justify-end gap-3 shrink-0 bg-white dark:bg-slate-900">
          {isLoading ? (
            <div className="text-xs font-bold text-slate-400 animate-pulse py-3">
              Importing batches sequentially... Please do not close this modal.
            </div>
          ) : importSummary ? (
            <ModalButton
              onClick={handleClose}
              className="bg-[#00B074] hover:bg-[#009675] text-white min-w-[150px] rounded-xl h-11 px-7 text-xs font-semibold tracking-wider transition-all active:scale-95 shadow-sm"
            >
              DONE
            </ModalButton>
          ) : (
            <>
              <ModalButton
                variant="outline"
                onClick={handleClose}
                className="rounded-xl h-11 px-7 border border-slate-250 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wider transition-all active:scale-95 hover:bg-slate-50/50 dark:hover:bg-slate-800 bg-white"
              >
                CANCEL
              </ModalButton>
              <ModalButton
                onClick={handleImport}
                disabled={rawRows.length === 0}
                className="bg-[#00B074] hover:bg-[#009675] text-white min-w-[150px] rounded-xl h-11 px-7 text-xs font-semibold tracking-wider transition-all active:scale-95 shadow-sm"
              >
                {t('importContacts', { defaultValue: 'IMPORT CONTACTS' })}
              </ModalButton>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
