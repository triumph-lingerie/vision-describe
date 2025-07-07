import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Copy, Download, Clock, AlertCircle, ChevronDown, ChevronRight, Code } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageResultProps {
  result: {
    id?: number;
    originalName: string;
    description?: string;
    createdAt?: Date | string;
    fileSize?: number;
    imageData?: string;
    language?: string;
    category?: string;
    error?: string;
  };
  className?: string;
}

export function ImageResult({ result, className }: ImageResultProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isJsonOpen, setIsJsonOpen] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!result.description) return;
    
    try {
      await navigator.clipboard.writeText(result.description);
      toast({
        title: "Copied!",
        description: "Description copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    if (!result.description) return;
    
    const blob = new Blob([result.description], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.originalName.split('.')[0]}_description.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported!",
      description: "Description exported as text file",
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTimeAgo = (date?: Date | string) => {
    if (!date) return '';
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  if (result.error) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold text-foreground">Processing Failed</h3>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">File:</span> {result.originalName}
            </p>
            <p className="text-sm text-destructive">
              <span className="font-medium">Error:</span> {result.error}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden fade-in", className)}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Image Preview */}
        <div className="relative aspect-video lg:aspect-square bg-muted">
          {result.imageData && (
            <>
              <img
                src={result.imageData}
                alt={result.originalName}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-300",
                  imageLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setImageLoaded(true)}
              />
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}
            </>
          )}
          
          <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm rounded-full p-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
          </div>
          
          {result.fileSize && (
            <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1">
              <span className="text-xs font-medium">{formatFileSize(result.fileSize)}</span>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Description</h3>
              <div className="flex items-center space-x-1">
                {result.language && (
                  <Badge variant="outline" className="text-xs h-5">
                    {result.language.toUpperCase()}
                  </Badge>
                )}
                {result.category && (
                  <Badge variant="outline" className="text-xs h-5">
                    {result.category}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs h-5">
                  GPT-4V
                </Badge>
              </div>
            </div>

            <div className="prose prose-sm max-w-none">
              <div 
                className="text-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: result.description || '' }}
              />
            </div>

            {/* JSON Debug Section */}
            <Collapsible open={isJsonOpen} onOpenChange={setIsJsonOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start text-xs text-muted-foreground hover:text-foreground mt-3"
                >
                  <Code className="h-3 w-3 mr-2" />
                  {isJsonOpen ? (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Hide API Response
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-3 w-3 mr-1" />
                      Show API Response
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <pre className="text-xs text-muted-foreground overflow-auto max-h-40">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatTimeAgo(result.createdAt)}</span>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={!result.description}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                disabled={!result.description}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
