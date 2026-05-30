"use client";

import React, { useRef, useState } from "react";

import { Category } from "@/enums";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import type { ScanReceiptResponse } from "@/lib/ai/scan-receipt-contract";
import { unwrapApiResponse } from "@/lib/api/api-response";
import { dispatchExpensePrefill } from "@/lib/expense-prefill";
import { compressImage } from "@/lib/image/compress-image";
import { Images, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import PixelLoader from "./ui/pixel-loader/PixelLoader";

type ScanStatus = "idle" | "scanning" | "error";

export type ReceiptScanDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const mapResultToPrefill = (result: ScanReceiptResponse) => {
  if (result.status === "success") {
    return {
      amount: result.receipt.total,
      note: result.receipt.merchant ?? "",
      category: result.receipt.category,
      date: result.receipt.date,
      source: "receipt_scan" as const,
    };
  }
  return {
    amount: result.prefill.amount ?? 0,
    note: result.prefill.note ?? "",
    category: Category.OTHER,
    source: "receipt_scan" as const,
  };
};

const ReceiptScanDrawer = ({ open, onOpenChange }: ReceiptScanDrawerProps) => {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const haptics = useAppHaptics();

  const runScan = async (file: File) => {
    setStatus("scanning");
    try {
      const imageBase64 = await compressImage(file, {
        maxEdge: 1280,
        quality: 0.7,
      });
      const response = await fetch("/api/ai/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      const result = unwrapApiResponse<ScanReceiptResponse>(
        await response.json(),
        response.status
      );

      if (result.status === "success") {
        haptics.success();
      } else {
        haptics.warning();
      }

      dispatchExpensePrefill(mapResultToPrefill(result));
      setStatus("idle");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to scan receipt", error);
      haptics.error();
      setStatus("error");
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      void runScan(file);
    }
  };

  const openGallery = () => galleryInputRef.current?.click();

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" modal>
      <DrawerContent className="gap-0">
        <DrawerHeader className="text-left">
          <DrawerTitle>Scan a receipt</DrawerTitle>
          <DrawerDescription>
            Choose a receipt photo from your device and we will draft an expense
            you can review.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col items-center gap-4 px-4 pb-8">
          <input
            ref={galleryInputRef}
            data-testid="receipt-gallery-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {status === "scanning" ? (
            <div className="text-muted-foreground inline-flex items-center gap-2.5 py-8 text-sm">
              <PixelLoader
                size="sm"
                pattern="wave"
                label="Reading the receipt"
              />
              Reading the receipt...
            </div>
          ) : status === "error" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-foreground text-[15px] font-medium">
                I could not read that receipt.
              </p>
              <p className="text-muted-foreground text-sm">
                Try another photo or add it manually.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5 rounded-full"
                onClick={openGallery}
              >
                <RefreshCw className="size-3.5" />
                Try again
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="lg"
              className="gap-2 rounded-full"
              onClick={openGallery}
            >
              <Images className="size-5" />
              Choose from device
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ReceiptScanDrawer;
