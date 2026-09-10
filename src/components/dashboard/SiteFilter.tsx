import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from 'lucide-react';

interface SiteFilterProps {
  sites: { id: string; site_name: string }[];
  selectedSiteId: string | 'all';
  onChange: (val: string) => void;
}

const SiteFilter = ({ sites, selectedSiteId, onChange }: SiteFilterProps) => {
  if (sites.length === 0) return null;

  return (
    <div className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border bg-background/50 px-2.5 py-1 sm:px-3">
        <Globe className="w-4 h-4 text-muted-foreground" />
        <Select value={selectedSiteId} onValueChange={onChange}>
        <SelectTrigger className="h-8 min-w-0 w-[min(180px,calc(100vw-5rem))] border-0 bg-transparent text-sm focus:ring-0">
                <SelectValue placeholder="All Websites" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Websites</SelectItem>
                {sites.map(site => (
                    <SelectItem key={site.id} value={site.id}>
                        {site.site_name || "Untitled Site"}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    </div>
  );
};

export default SiteFilter;