"use client";

interface LoadingIndicatorProps {
  message?: string;
}

export default function LoadingIndicator({ message = "Loading data..." }: LoadingIndicatorProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-tw-blue">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      <p className="mt-4 text-gray-300">{message}</p>
    </div>
  );
}
