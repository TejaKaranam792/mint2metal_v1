"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Table from "@/components/Table";
import { getApiKeys, generateApiKey, revokeApiKey } from "@/lib/api";

export default function DeveloperPortal({ embedded = false }: { embedded?: boolean }) {
  const { isAuthenticated, userType } = useAuth();
  const router = useRouter();

  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(["READ_ONLY"]);
  const [newlyGeneratedSecret, setNewlyGeneratedSecret] = useState<string | null>(null);
  const [error, setError] = useState("");

  const AVAILABLE_PERMISSIONS = [
    { id: "READ_ONLY", label: "Read Only", desc: "Price, vault, portfolio queries" },
    { id: "TRADE", label: "Trade", desc: "Buy, sell, price lock, redemptions" },
    { id: "FULL_ACCESS", label: "Full Access", desc: "All permissions" },
  ];

  const togglePermission = (p: string) => {
    if (p === "FULL_ACCESS") {
      setSelectedPermissions(["FULL_ACCESS"]);
      return;
    }
    setSelectedPermissions((prev) =>
      prev.includes("FULL_ACCESS")
        ? [p]
        : prev.includes(p)
          ? prev.filter((x) => x !== p)
          : [...prev.filter((x) => x !== "FULL_ACCESS"), p]
    );
  };

  useEffect(() => {
    if (embedded) return; // When embedded in admin page, skip auth redirects

    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    // "give the access of developer portal to every user"
    // Removed role check: (userType !== "API_INTEGRATOR" && userType !== "ADMIN")

    fetchKeys();
  }, [isAuthenticated, userType, router, embedded]);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const data = await getApiKeys();
      setKeys(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch API keys");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    if (selectedPermissions.length === 0)
      return setError("Select at least one permission");

    try {
      setGenerating(true);
      setError("");
      setNewlyGeneratedSecret(null);

      const res = await generateApiKey(newKeyName, selectedPermissions);
      setNewlyGeneratedSecret(res.apiKey);
      setNewKeyName("");
      setSelectedPermissions(["READ_ONLY"]);
      fetchKeys();
    } catch (err: any) {
      setError(err.message || "Failed to generate API key");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this API key? Any applications using it will immediately break.")) return;

    try {
      await revokeApiKey(id);
      fetchKeys(); // Refresh the table
    } catch (err: any) {
      setError(err.message || "Failed to revoke API key");
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  if (!embedded && loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-muted/20 border-t-foreground rounded-full animate-spin"></div>
      </div>
    );
  }

  // Format table rows
  const tableRows = keys.map((k) => {
    const rows = [
      k.name,
      k.permissions.join(", "),
      new Date(k.createdAt).toLocaleDateString(),
      k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never",
    ];

    if (userType === "ADMIN") {
      rows.splice(1, 0, k.user?.email || "Unknown");
    }

    rows.push(
      <Button
        key={k.id}
        variant="destructive"
        size="sm"
        onClick={() => handleRevoke(k.id)}
        className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
      >
        Revoke
      </Button>
    );

    return rows;
  });

  const tableHeaders = ["Key Name"];
  if (userType === "ADMIN") tableHeaders.push("Owner");
  tableHeaders.push("Permissions", "Created", "Last Used", "Actions");

  return (
    <div className="min-h-screen bg-background text-foreground p-6 sm:p-10">
      <div className="max-w-6xl mx-auto space-y-8 animate-reveal-up">

        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-500">
            Developer Portal
          </h1>
          <p className="text-muted-foreground text-lg mt-2">
            Manage your API Keys to integrate Mint2Metal into your own applications.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Generate New Key Card */}
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
          <CardHeader>
            <CardTitle className="text-xl">Generate New API Key</CardTitle>
            <CardDescription>
              Keys grant programmatic access to your account. Keep them secure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {newlyGeneratedSecret ? (
              <div className="bg-emerald-500/10 border border-emerald-500/50 p-6 rounded-lg space-y-4">
                <h3 className="text-emerald-400 font-semibold flex items-center gap-2">
                  <span>✓</span> API Key Generated Successfully
                </h3>
                <p className="text-sm text-emerald-400/80">
                  Please copy this key now. For your security, it will <strong>never be shown again</strong>.
                </p>
                <div className="bg-background border border-emerald-500/30 p-4 rounded-md flex items-center justify-between">
                  <code className="text-foreground tracking-wider font-mono">{newlyGeneratedSecret}</code>
                  <Button
                    variant="outline"
                    className="border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
                    onClick={() => navigator.clipboard.writeText(newlyGeneratedSecret)}
                  >
                    Copy
                  </Button>
                </div>
                <Button
                  variant="default"
                  className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setNewlyGeneratedSecret(null)}
                >
                  I have saved my key securely
                </Button>
              </div>
            ) : (
              <form onSubmit={handleGenerate} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Key Name (e.g. "Main Ecommerce Website")</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Enter a descriptive name"
                    className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                    required
                  />
                </div>

                {/* Permission Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Permissions</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {AVAILABLE_PERMISSIONS.map((perm) => {
                      const active = selectedPermissions.includes(perm.id);
                      return (
                        <button
                          key={perm.id}
                          type="button"
                          onClick={() => togglePermission(perm.id)}
                          className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${active
                            ? "border-purple-500 bg-purple-500/10 text-foreground"
                            : "border-border bg-surface text-muted-foreground hover:border-purple-500/50"
                            }`}
                        >
                          <span className="font-semibold text-sm">{perm.label}</span>
                          <span className="text-xs mt-0.5 opacity-70">{perm.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={generating || !newKeyName.trim() || selectedPermissions.length === 0}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition-all hover:scale-[1.01]"
                >
                  {generating ? "Generating..." : "Generate Key"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Existing Keys Table - "show the active api keys only to the admin not the user" */}
        {userType === "ADMIN" && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-xl">Active API Keys</CardTitle>
              <CardDescription>
                You have {keys.length} active keys granting access to your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {keys.length > 0 ? (
                <Table
                  headers={tableHeaders}
                  rows={tableRows}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground bg-surface/30 rounded-lg border border-border/50">
                  You haven't generated any API keys yet.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Documentation Highlight */}
        <div className="mt-12 bg-surface border border-border rounded-xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-foreground mb-2">Need Help Integrating?</h3>
            <p className="text-muted-foreground">
              Read our dedicated REST API documentation to learn how to fetch prices, create intents, and query vault status via your backend.
            </p>
          </div>
          <Button variant="outline" className="shrink-0 border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
            View API Docs →
          </Button>
        </div>

      </div>
    </div>
  );
}
