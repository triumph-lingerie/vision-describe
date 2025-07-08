import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ImageUpload } from "@/components/image-upload";
import { ImageResult } from "@/components/image-result";
import { ProductSettings } from "@/components/product-settings";
import { UrlCrawler } from "@/components/url-crawler";
import { ChevronDown, ChevronUp, HelpCircle, Upload, Globe } from "lucide-react";

export default function Home() {
  const [results, setResults] = useState<any[]>([]);
  const [settings, setSettings] = useState({ 
    language: "en", 
    category: "",
    certifications: [{ value: "" }],
  });
  const [isHowToOpen, setIsHowToOpen] = useState(false);

  const handleUploadComplete = (newResults: any[]) => {
    setResults((prev) => [...newResults, ...prev]);
  };

  const handleCrawlComplete = (newResults: any[]) => {
    setResults((prev) => [...newResults, ...prev]);
  };

  const handleSettingsChange = (newSettings: any) => {
    setSettings(newSettings);
  };

  return (
    <div className="min-h-screen flex flex-col">


      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-8">
        
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-medium text-foreground mb-2">
            Product Description Generator
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Generate professional e-commerce descriptions from uploaded images or by crawling product URLs
          </p>
        </div>

        {/* How to Use Section - Collapsible */}
        <div className="mb-8">
          <Collapsible open={isHowToOpen} onOpenChange={setIsHowToOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  <span className="font-medium">How to Use</span>
                </div>
                {isHowToOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-2">
              <div className="bg-muted/50 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Upload Images Method
                    </h3>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                        1
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">Configure Settings</h4>
                        <p className="text-sm text-muted-foreground">Set language, category, and certifications</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                        2
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">Upload Images</h4>
                        <p className="text-sm text-muted-foreground">Upload 1-10 product images (max 10MB each)</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      URL Crawling Method
                    </h3>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                        1
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">Enter Product URL</h4>
                        <p className="text-sm text-muted-foreground">Paste any product page URL</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                        2
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">Auto-Analysis</h4>
                        <p className="text-sm text-muted-foreground">AI detects language, category, and analyzes images automatically</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Settings Section */}
        <div className="space-y-8">
          {/* Input Method Tabs */}
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Create New
              </TabsTrigger>
              <TabsTrigger value="crawl" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Enhance Existing
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="space-y-6 mt-6">
              <ProductSettings 
                onSettingsChange={handleSettingsChange}
                defaultSettings={settings}
              />
              
              <ImageUpload 
                onUploadComplete={handleUploadComplete}
                language={settings.language}
                category={settings.category}
                certifications={settings.certifications}
              />
            </TabsContent>
            
            <TabsContent value="crawl" className="space-y-6 mt-6">
              <UrlCrawler 
                onCrawlComplete={handleCrawlComplete}
              />
            </TabsContent>
          </Tabs>

          {/* Results Section */}
          {results.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-foreground">Results</h2>
              <div className="space-y-6">
                {results.map((result, index) => (
                  <ImageResult
                    key={result.id || `${result.originalName}-${index}`}
                    result={result}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-8 mt-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <p className="text-sm text-muted-foreground">
                Powered by <a 
                  href="https://openai.com/index/gpt-4v-system-card/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-medium text-foreground hover:text-primary transition-colors duration-150"
                >
                  GPT-4 Vision
                </a>
              </p>
            </div>
            
            <div className="flex items-center space-x-6">
              <a 
                href="https://platform.openai.com/docs/guides/images-vision?api-mode=responses" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                API Documentation
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
