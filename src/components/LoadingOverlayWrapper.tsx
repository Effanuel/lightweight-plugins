"use client";

import React, { ReactNode } from "react";

interface LoadingOverlayWrapperProps {
  children: ReactNode;
  isLoading: boolean;
  message?: string;
}

export function LoadingOverlayWrapper({ children, isLoading, message = "Loading..." }: LoadingOverlayWrapperProps) {
  return (
    <div className="relative w-full h-full">
      {children}

      {isLoading && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[0.5px] flex items-center justify-center z-50 transition-opacity duration-300">
          <div className="flex flex-col items-center gap-2 bg-black/70 px-4 py-3 rounded-lg shadow-lg">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-white border-t-transparent"></div>
            <p className="text-gray-200 text-xs font-medium">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
