import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { ImageUpload } from "@/components/image-upload";
import { ImageResult } from "@/components/image-result";
import { ProductSettings } from "@/components/product-settings";
import { UrlCrawler } from "@/components/url-crawler";
import { Header } from "@/components/header";
import {
  HelpCircle,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";

export default function Home() {
  const [createResults, setCreateResults] = useState<any[]>([]);
  const [enhanceResults, setEnhanceResults] = useState<any[]>([]);
  const [settings, setSettings] = useState({
    language: "en",
    category: "",
    certifications: [{ value: "" }],
  });
  const [isCreateHowToOpen, setIsCreateHowToOpen] = useState(false);
  const [isEnhanceHowToOpen, setIsEnhanceHowToOpen] = useState(false);
  const [isSettingsSaved, setIsSettingsSaved] = useState(false);

  const handleUploadComplete = (newResults: any[]) => {
    setCreateResults((prev) => [...newResults, ...prev]);
  };

  const handleCrawlComplete = (newResults: any[]) => {
    setEnhanceResults((prev) => [...newResults, ...prev]);
  };

  const clearCreateResults = () => {
    setCreateResults([]);
  };

  const clearEnhanceResults = () => {
    setEnhanceResults([]);
  };

  const handleSettingsChange = (newSettings: any) => {
    setSettings(newSettings);
    setIsSettingsSaved(true);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-medium text-foreground mb-2">
            Generate product descriptions from images and URLs
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Transform product images into compelling marketing content for your
            e-commerce store. Upload photos directly or crawl existing product
            pages to enhance descriptions with AI-powered visual analysis.
          </p>
        </div>

        {/* Settings Section */}
        <div className="space-y-8">
          {/* Input Method Tabs */}
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create New
              </TabsTrigger>
              <TabsTrigger value="crawl" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Enhance Existing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-6 mt-6">
              {/* How to Use for Create New */}
              <Collapsible
                open={isCreateHowToOpen}
                onOpenChange={setIsCreateHowToOpen}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      <span className="font-medium">How to Use</span>
                    </div>
                    {isCreateHowToOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="mt-2">
                  <div className="bg-muted/50 rounded-lg p-6">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                          1
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">
                            Configure Settings
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Choose language, product category, and any
                            certifications
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                          2
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">
                            Upload Images
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Drag & drop or select 1-10 product photos (max 10MB
                            each)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                          3
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">
                            AI Analysis
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            AI examines your photos and identifies key product
                            features
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                          4
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">
                            Get Results
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Download professional descriptions ready for your
                            website
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <ProductSettings
                onSettingsChange={handleSettingsChange}
                defaultSettings={settings}
              />

              <p className="text-xs text-muted-foreground text-center">
                AI-generated content - review before use
              </p>

              {isSettingsSaved && (
                <ImageUpload
                  onUploadComplete={handleUploadComplete}
                  language={settings.language}
                  category={settings.category}
                  certifications={settings.certifications}
                />
              )}
            </TabsContent>

            <TabsContent value="crawl" className="space-y-6 mt-6">
              {/* How to Use for Enhance Existing */}
              <Collapsible
                open={isEnhanceHowToOpen}
                onOpenChange={setIsEnhanceHowToOpen}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      <span className="font-medium">How to Use</span>
                    </div>
                    {isEnhanceHowToOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="mt-2">
                  <div className="bg-muted/50 rounded-lg p-6">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                          1
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">
                            Enter Product URL
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Copy and paste any e-commerce product page link
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                          2
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">
                            Extract Images
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            AI scans the page and finds all product photos
                            automatically
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                          3
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">
                            Auto-Detect Settings
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Smart detection of product type, language, and
                            category
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                          4
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">
                            Generate Enhanced Copy
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Create better marketing descriptions than the
                            original
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <UrlCrawler onCrawlComplete={handleCrawlComplete} />
            </TabsContent>
          </Tabs>

          {/* Create New Results Section */}
          {createResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-foreground">
                  Create New Results
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCreateResults}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Results
                </Button>
              </div>
              <div className="space-y-6">
                {createResults.map((result, index) => (
                  <ImageResult
                    key={result.id || `${result.originalName}-${index}`}
                    result={result}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Enhance Existing Results Section */}
          {enhanceResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-foreground">
                  Enhance Existing Results
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearEnhanceResults}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Results
                </Button>
              </div>
              <div className="space-y-6">
                {enhanceResults.map((result, index) => (
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
                Copyright Vision Describe 2025
              </p>
            </div>

            <div className="flex items-center space-x-6">
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                Terms
              </Link>
              <a
                href="https://platform.openai.com/docs/guides/images-vision?api-mode=responses"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                API Docs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
