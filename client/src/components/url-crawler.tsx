import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Globe, Eye, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface UrlCrawlerProps {
  onCrawlComplete: (results: any[]) => void;
}

export function UrlCrawler({ onCrawlComplete }: UrlCrawlerProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCrawl = async () => {
    if (!url.trim()) {
      setError("Please enter a valid URL");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest("POST", "/api/crawl", {
        url: url.trim(),
      });
      const data = await response.json();
      onCrawlComplete(data.results);
      setUrl("");
    } catch (error) {
      console.error("Crawling error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while crawling the URL",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          <h3 className="text-base font-semibold">URL Product Crawler</h3>
        </CardTitle>
        <CardDescription>
          Enter a product page URL to automatically detect language, category,
          and analyze product images
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="url">Product Page URL</Label>
          <div className="flex gap-2">
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/product-page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleCrawl}
              disabled={isLoading || !url.trim()}
              className="min-w-[100px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Crawling...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Crawl
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
            {error}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-muted-foreground/20">
          <p className="text-xs text-muted-foreground">
            Requires OpenAI API key and Firecrawl API key. Get them at{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              platform.openai.com
            </a>
            {" and "}
            <a
              href="https://www.firecrawl.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              firecrawl.dev
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
