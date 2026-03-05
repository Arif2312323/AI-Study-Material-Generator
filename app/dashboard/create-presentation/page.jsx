"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import Link from "next/link";
import { Presentation, Download, ArrowLeft, Loader2 } from "lucide-react";

export default function CreatePresentationPage() {
  const [topic, setTopic] = useState("");
  const [numSlides, setNumSlides] = useState(5);
  const [loading, setLoading] = useState(false);
  const [presentation, setPresentation] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }

    setLoading(true);
    setPresentation(null);

    try {
      const res = await fetch("/api/presentation/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          num_slides: Math.min(20, Math.max(1, numSlides)),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create presentation");
      }

      setPresentation(data);
      toast.success("Presentation created! Download it below.");
    } catch (err) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!presentation?.presentation_id) return;
    window.open(`/api/presentation/${presentation.presentation_id}/download`, "_blank");
    toast.success("Download started");
  };

  const handleReset = () => {
    setPresentation(null);
    setTopic("");
    setNumSlides(5);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-100 rounded-lg">
          <Presentation className="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Create AI Presentation</h1>
          <p className="text-gray-500 text-sm">
            Generate a PowerPoint from any topic using AI
          </p>
        </div>
      </div>

      {!presentation ? (
        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Topic</label>
            <Textarea
              placeholder="e.g. Artificial Intelligence, Climate Change, Machine Learning Basics"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="min-h-[100px]"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Number of slides (1–20)
            </label>
            <Input
              type="number"
              min={1}
              max={20}
              value={numSlides}
              onChange={(e) => setNumSlides(Number(e.target.value) || 5)}
              disabled={loading}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Generating presentation…
              </>
            ) : (
              "Generate Presentation"
            )}
          </Button>
        </form>
      ) : (
        <div className="border rounded-xl p-6 bg-gray-50 space-y-4">
          <div className="flex items-center gap-2 text-green-600">
            <Presentation className="w-5 h-5" />
            <span className="font-medium">Presentation ready</span>
          </div>
          <p className="text-gray-600">
            <strong>Topic:</strong> {presentation.topic}
          </p>
          <div className="flex gap-3">
            <Button onClick={handleDownload} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download PPTX
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Create another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
