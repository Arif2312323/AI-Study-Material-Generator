"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function DocumentViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const documentId = params.documentId;

  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (documentId) {
      fetchDocument();
    }
  }, [documentId]);

  const fetchDocument = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/rag/document/${documentId}`);
      const data = await res.json();

      if (res.ok) {
        setDocument(data);
      } else {
        setError(data.error || "Failed to load document");
      }
    } catch (err) {
      setError("Failed to load document");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setQueryLoading(true);
      setAnswer("");
      setError("");

      const res = await fetch("/api/rag/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query,
          documentId: parseInt(documentId),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setAnswer(data.answer);
      } else {
        setError(data.error || "Failed to process query");
      }
    } catch (err) {
      setError("Failed to process query");
      console.error(err);
    } finally {
      setQueryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-5">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => router.push("/rag")}>
            Go Back to Upload
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-5 md:px-24 lg:px-36 mt-10">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.push("/rag")}
          className="mb-4"
        >
          ← Back to Upload
        </Button>
        <h1 className="font-bold text-4xl text-primary mb-2">
          {document?.fileName || "Document Viewer"}
        </h1>
        {document?.summary && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h2 className="font-semibold text-lg mb-2">Summary</h2>
            <p className="text-gray-700 whitespace-pre-wrap">
              {document.summary}
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Content */}
        <div className="space-y-4">
          <h2 className="font-semibold text-2xl">Document Content</h2>
          <div className="bg-white border rounded-lg p-6 max-h-[600px] overflow-y-auto">
            {document?.content ? (
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {document.content}
                </pre>
              </div>
            ) : (
              <p className="text-gray-500">
                Document is still being processed. Please wait...
              </p>
            )}
          </div>
        </div>

        {/* Query Section */}
        <div className="space-y-4">
          <h2 className="font-semibold text-2xl">Ask Questions</h2>
          <form onSubmit={handleQuery} className="space-y-4">
            <div>
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question about the document..."
                className="w-full"
                disabled={queryLoading || !document?.content}
              />
            </div>
            <Button
              type="submit"
              disabled={queryLoading || !document?.content}
              className="w-full"
            >
              {queryLoading ? "Processing..." : "Ask Question"}
            </Button>
          </form>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {answer && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">Answer</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{answer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

