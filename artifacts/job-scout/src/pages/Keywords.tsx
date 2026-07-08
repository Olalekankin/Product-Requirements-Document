import React, { useState } from "react";
import { useListKeywords, useCreateKeyword, useUpdateKeyword, useDeleteKeyword, getListKeywordsQueryKey } from "@workspace/api-client-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Button, Input, Badge } from "@/components/ui/core";
import { Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Keywords() {
  const queryClient = useQueryClient();
  const { data: keywords, isLoading } = useListKeywords();
  
  const createKeyword = useCreateKeyword();
  const updateKeyword = useUpdateKeyword();
  const deleteKeyword = useDeleteKeyword();
  
  const [newTerm, setNewTerm] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim()) return;
    
    createKeyword.mutate({ data: { term: newTerm.trim(), enabled: true } }, {
      onSuccess: () => {
        setNewTerm("");
        queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
        toast.success("Keyword added");
      }
    });
  };

  const handleToggle = (id: number, enabled: boolean) => {
    updateKeyword.mutate({ id, data: { enabled: !enabled } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() })
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Remove this keyword?")) return;
    deleteKeyword.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
        toast.success("Keyword removed");
      }
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto flex flex-col h-full">
      <PageHeader 
        title="Search Target Keywords" 
        description="Terms the scanner uses to find relevant opportunities."
      />

      <Card className="mb-8 p-1">
        <form onSubmit={handleAdd} className="flex gap-2 p-2">
          <Input 
            placeholder="e.g. 'Senior Frontend Engineer', 'React', 'Design Engineer'" 
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            disabled={createKeyword.isPending}
            className="border-0 shadow-none focus-visible:ring-0 text-base h-12 px-4"
          />
          <Button type="submit" disabled={createKeyword.isPending || !newTerm.trim()} size="lg">
            <Plus className="w-5 h-5 mr-2" /> Add Keyword
          </Button>
        </form>
      </Card>

      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center animate-pulse text-muted-foreground">Loading keywords...</div>
        ) : (!keywords || keywords.length === 0) ? (
          <div className="p-12 text-center text-muted-foreground">
            No keywords defined. Add some to start scanning for jobs.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {keywords.map(kw => (
              <div key={kw.id} className={`flex items-center justify-between p-4 transition-colors hover:bg-muted/50 ${!kw.enabled && 'opacity-60 bg-muted/20'}`}>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => handleToggle(kw.id, kw.enabled)}
                    className={`shrink-0 transition-colors ${kw.enabled ? 'text-green-500' : 'text-muted-foreground'}`}
                  >
                    {kw.enabled ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                  </button>
                  <span className={`text-lg font-medium ${!kw.enabled && 'line-through text-muted-foreground'}`}>
                    {kw.term}
                  </span>
                </div>
                
                <div className="flex items-center gap-4">
                  <Badge variant={kw.enabled ? "default" : "secondary"}>
                    {kw.enabled ? "ACTIVE" : "PAUSED"}
                  </Badge>
                  <Button 
                    variant="ghost-danger" 
                    size="icon"
                    onClick={() => handleDelete(kw.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
