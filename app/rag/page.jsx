"use client";

import React, { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function UploadPage() {
  const { user } = useUser();
  const router = useRouter();
  const [file, setFile] = useState();
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError("Please select a file");
      return;
    }
    
    const formData = new FormData();
    formData.append("file", file);
    setStatus("Uploading and processing…");
    setUploading(true);
    setError("");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        headers: {
          "x-user-id": user?.id || "",
        },
      });
      
      const data = await res.json();
      
      if (res.ok && data.documentId) {
        setStatus("Upload successful! Redirecting...");
        // Route to document viewer page
        setTimeout(() => {
          router.push(`/rag/${data.documentId}`);
        }, 1000);
      } else {
        setError(data.error || "Upload failed. Please try again.");
        setStatus("");
      }
    } catch (err) {
      setError("Failed to upload file. Please try again.");
      setStatus("");
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center p-5 md:px-24 lg:px-36 mt-20">
      <h2 className="font-bold text-4xl text-primary ">
        Start Building your Personal Study Material
      </h2>
      <p className="text-gray-500 text-lg">
        Upload your document for material generation
      </p>
      <div className="mt-10 w-full max-w-md">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 flex flex-col items-center"
        >
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setError("");
            }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            disabled={uploading}
          />
          {error && (
            <div className="w-full p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
              {error}
            </div>
          )}
          {status && (
            <div className="w-full p-3 bg-blue-50 border border-blue-200 rounded text-blue-600 text-sm">
              {status}
            </div>
          )}
          <Button
            type="submit"
            disabled={uploading || !file}
            className="px-4 py-2 bg-blue-600 text-white rounded w-full"
          >
            {uploading ? "Processing..." : "Upload"}
          </Button>
        </form>
      </div>
    </div>
  );
}
