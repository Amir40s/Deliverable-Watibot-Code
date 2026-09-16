"use client"

import React, { useState } from "react"
import {
    X,
    HelpCircle,
    UploadCloud,
    Check,
    ArrowRight
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface KYCModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

const steps = [
    { number: 1, label: "GST Details" },
    { number: 2, label: "Communication" },
    { number: 3, label: "Verify OTP" },
    { number: 4, label: "Done" },
]

export function KYCModal({ isOpen, onOpenChange }: KYCModalProps) {
    const [currentStep, setCurrentStep] = useState(1)
    const [gstNumber, setGstNumber] = useState("")

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[800px] p-0 overflow-hidden border-none rounded-3xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-8 pb-4 relative shrink-0">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="absolute right-6 top-6 text-[#9CA3AF] hover:text-[#374151] transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-2xl font-bold text-[#1F2937]">Complete your KYC</DialogTitle>
                        <p className="text-[#6B7280] text-[15px]">Start KYC with GST or verify via MSME or other documents.</p>
                    </DialogHeader>
                </div>

                {/* Stepper */}
                <div className="px-12 py-8 flex items-center justify-between relative mb-4 shrink-0">
                    <div className="absolute top-[48%] left-12 right-12 h-[1px] bg-[#E5E7EB] -translate-y-1/2 z-0" />
                    {steps.map((step, idx) => (
                        <div key={step.number} className="flex flex-col items-center gap-3 relative z-10 bg-white px-2">
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-bold transition-all",
                                step.number === currentStep
                                    ? "bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20"
                                    : "bg-[#F3F4F6] text-[#9CA3AF]"
                            )}>
                                {step.number < currentStep ? <Check className="w-5 h-5" /> : step.number}
                            </div>
                            <span className={cn(
                                "text-[12px] font-bold tracking-tight text-center whitespace-nowrap",
                                step.number === currentStep ? "text-[#1F2937]" : "text-[#9CA3AF]"
                            )}>
                                {step.label}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Scrollable Content */}
                <div className="px-8 pb-8 space-y-6 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                    {/* Info Alert */}
                    <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl p-6">
                        <p className="text-[#92400E] text-[15px] font-bold leading-relaxed mb-4">
                            Please ensure that your Facebook portfolio name is the same as legal name on the GST document, to update your Facebook portfolio name:
                        </p>
                        <ol className="list-decimal pl-5 space-y-2 text-[#92400E]/80 text-[14px] font-medium">
                            <li>Go to your Facebook Business Manager using the following <span className="text-[#10B981] font-bold cursor-pointer underline">link here.</span></li>
                            <li>Click on the correct Facebook Business Manager.</li>
                            <li>Scroll down to the left-hand side and click on <span className="font-bold">Business Info/Portfolio.</span></li>
                            <li>Click on the edit option in front of your FBM name.</li>
                            <li>Update your FBM name as per your GST certificate.</li>
                            <li>Click on "Save".</li>
                            <li>Apply/Reapply for KYC verification.</li>
                        </ol>
                    </div>

                    {/* GST Number Field */}
                    <div className="space-y-2.5">
                        <Label className="text-[14px] font-bold text-[#374151]">
                            Enter your GST Number <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative group">
                            <Input
                                placeholder="GST NUMBER"
                                value={gstNumber}
                                onChange={(e) => setGstNumber(e.target.value)}
                                className="h-14 bg-[#F3F4F6] border-none rounded-xl text-[14px] font-bold placeholder:text-[#9CA3AF] placeholder:focus-visible:ring-1 focus-visible:ring-[#10B981]/20 px-4"
                            />
                            <HelpCircle className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#9CA3AF] cursor-pointer hover:text-[#374151] transition-colors" />
                        </div>
                    </div>

                    {/* File Upload Field */}
                    <div className="space-y-2.5">
                        <Label className="text-[14px] font-bold text-[#374151]">
                            Upload GST document <span className="text-red-500">*</span>
                        </Label>
                        <div className="border-2 border-dashed border-[#E5E7EB] rounded-2xl p-10 flex flex-col items-center justify-center gap-4 bg-white hover:bg-[#F9FAFB] transition-colors cursor-pointer group">
                            <div className="w-12 h-12 bg-[#F3F4F6] text-[#9CA3AF] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                <UploadCloud className="w-6 h-6" />
                            </div>
                            <span className="text-[15px] font-bold text-[#6B7280]">Click to Upload or drag and drop</span>
                        </div>
                    </div>

                    {/* Alternative Methods Banner */}
                    <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-6 flex items-center justify-between">
                        <p className="text-[15px] font-bold text-[#4B5563]">Don't have GST? Try alternative verification methods instead.</p>
                        <Button variant="outline" className="border-[#123E40] text-[#123E40] font-bold h-11 px-8 rounded-xl hover:bg-[#123E40] hover:text-white transition-all text-xs tracking-wider">
                            MSME
                        </Button>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-8 py-6 border-t border-[#F3F4F6] flex justify-end gap-3 bg-white shrink-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="h-12 px-8 rounded-xl font-bold text-[#374151] hover:bg-[#F3F4F6] border-[#E5E7EB]"
                    >
                        Cancel
                    </Button>
                    <Button
                        disabled
                        className="h-12 px-10 rounded-xl font-bold bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed border-none shadow-none"
                    >
                        Verify
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
